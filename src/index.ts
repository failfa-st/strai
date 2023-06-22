import { config } from "dotenv";

import OBSRemoteControl from "./components/OBSRemoteControl.js";

config();

const obsRemoteControl = new OBSRemoteControl({
	password: process.env.OBS_PASSWORD,
	defaultVideoPath: process.env.OBS_DEFAULT_VIDEO,
});

await obsRemoteControl.connect();

//
// await obsRemoteControl.addVideo(
// 	"/fullpath/to/video.mp4"
// );
