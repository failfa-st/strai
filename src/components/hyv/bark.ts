import type { ModelAdapter } from "@hyv/core";
import { urlJoin } from "@hyv/utils";
import axios from "axios";
import { nanoid } from "nanoid";

import type { BarkAnswer, BarkInput, BarkOutput, Voice } from "./types.js";

export interface BarkOptions {
	textTemperature?: number;
	waveformTemperature?: number;
	voice?: Voice;
	batchSize?: number;
	silent?: boolean;
}

export class BarkModelAdapter implements ModelAdapter<BarkInput, BarkOutput> {
	private _options: BarkOptions;
	private readonly rootUrl: string = "http://127.0.0.1:3000";

	constructor(options: BarkOptions = {}, rootUrl?: string) {
		this._options = options;
		if (rootUrl) {
			this.rootUrl = rootUrl;
		}
	}

	/**
	 * Assigns a task to the model and returns the results
	 * @param task - The task that is assigned to the model
	 */
	async assign(task: BarkInput) {
		try {
			const fileName = task.fileName ?? nanoid();
			const { data } = await axios.post<{ answers: BarkAnswer[]; fileNameBase: string }>(
				urlJoin(this.rootUrl, "generate"),
				{
					...this._options,
					...task,
					fileName,
				}
			);

			return data;
		} catch (error) {
			throw new Error(`Error assigning task in BarkModelAdapter: ${error.message}`);
		}
	}
}
