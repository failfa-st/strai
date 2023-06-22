export type Video = {
	videoPath: string;
	videoId: number;
	videoName: string;
	state: "new" | "playing" | "ended";
};

export default class VideoQueue {
	public queue: Video[];

	constructor() {
		this.queue = [];
	}

	enqueue(videoPath: string, videoId: number, videoName: string): void {
		this.queue.push({ videoPath, videoId, videoName, state: "new" });
	}

	dequeue(): Video | null {
		if (this.isEmpty()) {
			return null;
		}

		return this.queue.shift() || null;
	}

	peek(): Video | null {
		if (this.isEmpty()) {
			return null;
		}

		return this.queue[0];
	}

	getByName(videoName: string): Video | null {
		return this.queue.filter(video => video.videoName === videoName)[0];
	}

	isEmpty(): boolean {
		return this.queue.length === 0;
	}
}
