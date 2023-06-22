import { config } from "dotenv";

import OBSRemoteControl from "./components/OBSRemoteControl.js";

config();

const obsRemoteControl = new OBSRemoteControl({
	password: process.env.OBS_WEBSOCKET_SERVER_PASSWORD,
});

await obsRemoteControl.connect();

//
// await obsRemoteControl.addVideo(
// 	"/fullpath/to/video.mp4"
// );
