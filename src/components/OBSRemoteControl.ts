/* eslint-disable camelcase */
/* eslint-disable no-negated-condition */
import type EventEmitter from "node:events";

import { nanoid } from "nanoid";
import OBSWebSocket from "obs-websocket-js";

import type { Video } from "./VideoQueue.js";
import VideoQueue from "./VideoQueue.js";

type State = "default" | "queue";

type OBSRemoteControlProps = {
	host?: string;
	password: string;
	sceneDefault?: string;
	sceneQueue?: string;
	mediaSourceDefaultVideo?: string;
	mediaSourceQueueVideo1?: string;
	mediaSourceQueueVideo2?: string;
};

export default class OBSRemoteControl {
	public obs: OBSWebSocket;
	private host: string;
	private password: string;
	private videoQueue: VideoQueue;
	private defaultSceneItemTransform: Record<string, unknown>;
	private sceneDefault: string;
	private sceneQueue: string;
	private mediaSourceDefaultVideo: string;
	private state: State;

	constructor({
		host = "ws:localhost:4455",
		password = "",
		sceneDefault = "default",
		sceneQueue = "queue",
		mediaSourceDefaultVideo = "defaultVideo",
	}: OBSRemoteControlProps) {
		this.obs = new OBSWebSocket();
		this.host = host;
		this.password = password;
		this.sceneDefault = sceneDefault;
		this.sceneQueue = sceneQueue;
		this.mediaSourceDefaultVideo = mediaSourceDefaultVideo;
		this.videoQueue = new VideoQueue();
		this.state = "default";

		// Hack to get "on" working
		(this.obs as unknown as EventEmitter).on(
			"MediaInputPlaybackEnded",
			this.onMediaEnded.bind(this)
		);
	}

	connect() {
		return this.obs
			.connect(this.host, this.password)
			.then(async () => {
				console.log("Successfully connected to OBS.");

				this.setup();
			})
			.catch(err => {
				console.error("Unable to connect to OBS:", err);
			});
	}

	async setup() {
		try {
			const itemList = await this.obs.call("GetSceneItemList", {
				sceneName: this.sceneDefault,
			});

			const _defaultVideoItem = itemList.sceneItems.filter(
				item => item.sourceName === this.mediaSourceDefaultVideo
			)[0];

			const { sceneItemTransform, sceneItemId } = _defaultVideoItem as any;

			// Set some defaults as they need to be at least using a value of 1.0,
			// anything below will throw an error
			sceneItemTransform.boundsWidth = 1.0;
			sceneItemTransform.boundsHeight = 1.0;

			// Save the transform to use it as the default when adding new media sources
			this.defaultSceneItemTransform = sceneItemTransform;

			// Enable the default video
			await this.obs.call("SetSceneItemEnabled", {
				sceneName: this.sceneDefault,
				sceneItemEnabled: true,
				sceneItemId: sceneItemId as number,
			});
		} catch (error) {
			console.error(error);
		}
	}

	async addVideo(videoFile: string): Promise<Promise<Promise<void>>> {
		console.log("addVideo", videoFile);

		const queueVideoItemName = `${this.sceneQueue}-${nanoid()}`;

		const response = await this.obs.callBatch([
			{
				requestType: "CreateInput",
				requestData: {
					sceneName: this.sceneQueue,
					inputName: queueVideoItemName,
					inputKind: "ffmpeg_source",
					sceneItemEnabled: false,
					inputSettings: {
						clear_on_media_end: false,
						hw_decode: true,
						looping: false,
						restart_on_activate: true,
						local_file: videoFile,
					},
				},
			},
		]);
		const _queueVideoItemId = (response[0].responseData as any).sceneItemId;

		await this.obs.call("SetSceneItemTransform", {
			sceneName: this.sceneQueue,
			sceneItemId: _queueVideoItemId,
			sceneItemTransform: this.defaultSceneItemTransform as any,
		});

		// Add the video to queue
		this.videoQueue.enqueue(videoFile, _queueVideoItemId, queueVideoItemName);

		if (this.state === "default") {
			console.log("state: queue");
			this.state = "queue";

			setTimeout(async () => {
				await this.playNext();
			}, 500);
		}
	}

	async isVideoEnabled(videoId: number) {
		return this.obs.call("GetSceneItemEnabled", {
			sceneName: this.sceneQueue,
			sceneItemId: videoId,
		});
	}

	async onMediaEnded(data: { inputName: string }): Promise<void> {
		const { inputName } = data;

		//
		// console.log(
		// 	"GetMediaInputStatus",
		// 	inputName,
		// 	await this.obs.call("GetMediaInputStatus", { inputName }),
		// 	(await this.isVideoEnabled(this.videoQueue.getByName(inputName).videoId))
		// 		.sceneItemEnabled
		// );

		// Only do something if the input was enabled
		if (
			(await this.isVideoEnabled(this.videoQueue.getByName(inputName).videoId))
				.sceneItemEnabled
		) {
			// We still have something in the queue
			// AND it's not the default video that finished playing (because that event is triggered once,
			// even when the default video is looped)
			if (this.state === "queue" && inputName.startsWith(this.sceneQueue)) {
				console.log("ended", inputName);

				await this.obs.call("RemoveInput", { inputName });

				this.videoQueue.dequeue();

				await this.playNext();
			}
		}
	}

	async playNext(video?: Video | null): Promise<void> {
		const nextVideo = video ?? this.videoQueue.peek();

		if (nextVideo !== null) {
			console.log("playNext", nextVideo?.videoPath);

			await this.obs
				.callBatch([
					{
						requestType: "SetInputAudioMonitorType",
						requestData: {
							inputName: (nextVideo as Video).videoName,
							monitorType: "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT",
						},
					},
					{
						requestType: "SetSceneItemEnabled",
						requestData: {
							sceneName: this.sceneQueue,
							sceneItemId: (nextVideo as Video).videoId,
							sceneItemEnabled: true,
						},
					},
				])
				.catch(err => {
					console.error("Error in queue batch call:", err);
				});

			this.state = "queue";
		} else {
			console.log("state: default");

			this.state = "default";
		}
	}
}
