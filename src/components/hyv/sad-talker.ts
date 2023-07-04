import type { ModelAdapter, ModelMessage } from "@hyv/core";
import { urlJoin } from "@hyv/utils";
import axios from "axios";

export class SadTalkerModelAdapter implements ModelAdapter<ModelMessage, ModelMessage> {
	private _options: ModelMessage;
	private readonly rootUrl: string = "http://127.0.0.1:3000";

	constructor(options: ModelMessage = {}, rootUrl?: string) {
		this._options = options;
		if (rootUrl) {
			this.rootUrl = rootUrl;
		}
	}

	/**
	 * Assigns a task to the model and returns the results
	 * @param task - The task that is assigned to the model
	 */
	async assign(task: ModelMessage) {
		try {
			const { data } = await axios.post(urlJoin(this.rootUrl, "generate"), {
				...this._options,
				...task,
			});

			return data;
		} catch (error) {
			throw new Error(`Error assigning task in SadTalkerModelAdapter: ${error.message}`);
		}
	}
}
