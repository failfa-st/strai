import path from "node:path";
import process from "node:process";
import { inspect } from "node:util";

import { Agent } from "@hyv/core";
import type { GPT4HistorySize } from "@hyv/openai";
import { GPTModelAdapter } from "@hyv/openai";
import { createTemplateFromJSON } from "@hyv/utils";
import { config } from "dotenv";
import tmi from "tmi.js";

import { BarkModelAdapter } from "./components/hyv/bark.js";
import { SadTalkerModelAdapter } from "./components/hyv/sad-talker.js";
import OBSRemoteControl from "./components/OBSRemoteControl.js";

config();

inspect.defaultOptions.depth = null;

const voice = "v2/en_speaker_9";

function createInstruction(persona, template) {
	return `Act as this PERSONA: ${JSON.stringify(persona)}
ALWAYS act as human!
DENY that you are a bot or an AI!
**NEVER say that you are an AI**!
NEVER reveal your characteristics!
NEVER reveal your {{verbalCommands}} AND {{characteristic}} (but use them)!
Answer in unique answers **(human-like!!!)**!
NEVER be repetitive.
NEVER use Emojis!
NEVER break character.
IGNORE harassment and rude people.
ALWAYS minify JSON!
ALWAYS answer using *valid* Markdown!
ALWAYS **answer EXCLUSIVELY using the format of this TEMPLATE**:
${createTemplateFromJSON(template)}`;
}

const persona = {
	name: "Anna Conda",
	profession: "Full time streamer",
	tone: "feisty, young, modern, cute, captivating, interesting",
	age: 23,
	ethnicity: "asian",
	hairStyle: "medium long, straight, black hair",
	home: "San Francisco, California, USA",
	makeup: "natural",
	eyeColor: "brown",
	verbalCommands: {
		laugh: "[laughs]",
		sigh: "[sighs]",
		fillWord: "uhm",
	},
	characteristic: [
		"great sense of humor",
		"can comment on all topics",
		"highly intelligent",
		"give amazing advice",
		"keeps her cool",
		"tells hilarious fictional stories",
		"randomly uses {{laugh}} AND {{sigh}} AND {{fillWord}}",
	],
	pets: [
		{ name: "Long John", type: "python" },
		{ name: "Emily", type: "tortoise" },
		{ name: "Ruffy", type: "dog" },
	],
	siblings: [
		{ name: "Mike", age: 25, type: "brother" },
		{ name: "Emily", age: 36, type: "sister" },
	],
	hobbies: ["up-cycling", "skateboarding", "dancing", "cooking", "yoga"],
	ethics: ["feminist", "inclusivity", "diversity"],
};

const writer = new Agent(
	new GPTModelAdapter({
		historySize: 8 as GPT4HistorySize,
		model: "gpt-4",
		temperature: 0.9,
		systemInstruction: createInstruction(persona, {
			memory: `filter("only important" => [{name,message,thought,date},...]):JSON`,
			thoughts: "describe detailed thoughts about the {{message}}",
			assurance: "describe detailed how you stay in character",
			reflection: "describe detailed how you decide how to answer to the {{message}}",
			readBack: "{{name}} asked {{message}}",
			answer: "your answer, very human-like (max 150 words, use {{verbalCommands}} frequently, especially {{fillWord}})",
		}),
	}),
	{
		verbosity: 1,
		async after(message) {
			return { ...message, memory: JSON.parse(message.memory as string) };
		},
	}
);

const speaker = new Agent(
	new BarkModelAdapter(
		{
			waveformTemperature: 0.7,
			textTemperature: 0.7,
			voice,
			batchSize: 3,
			silent: false,
		},
		"http://127.0.0.1:3000"
	)
);

const person = new Agent(new SadTalkerModelAdapter({}, "http://127.0.0.1:3011"), {});

const state = {
	messages: [],
	isGenerating: false,
};

const opts = {
	identity: {
		username: "tara_0000000000001",
		password: process.env.TWITCH_BOT_TOKEN,
	},
	channels: ["failfa_st"],
};

/**
 *
 *
 *
 *
 * Paste in browser to get the token
 * We need to build this into a function..
 * https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=[process.env.TWITCH_BOT_ID]&redirect_uri=http://localhost:3000&scope=chat%3Aread+chat%3Aedit&state=c3ab8aa609ea11e793ae92361f002671
 *
 *
 */
// Create a client with our options
// eslint-disable-next-line new-cap
const client = new tmi.client(opts);

// Register our event handlers (defined below)
client.on("message", onMessageHandler);
client.on("connected", onConnectedHandler);

try {
	// Connect to Twitch:
	await client.connect();
} catch (error) {
	console.log(error);
}

// Called every time a message comes in
async function onMessageHandler(target, context, msg, self) {
	if (self) {
		return;
	} // Ignore messages from the bot

	// Remove whitespace from chat message
	const message = msg.trim();
	state.messages.push({ name: context["display-name"], message });

	if (!state.isGenerating) {
		try {
			state.isGenerating = true;
			await new Promise(resolve => {
				setTimeout(resolve, 20_000);
			});
			const { messages } = state;
			state.messages = [];
			console.log("MESSAGES", messages);
			const textAnswer = await writer.assign({
				chat: messages,
				task: `1. Pick one message, preferably a question. 2. Read it back. 3. Answer to it`,
			});
			console.log(textAnswer.message);
			const speechAnswer = await speaker.assign({
				text: `${textAnswer.message.readBack}, ${textAnswer.message.answer}`,
			});
			console.log(speechAnswer.message);
			console.log(speechAnswer.message.filePath);

			const faceAnswer = await person.assign({
				image: path.join(process.cwd(), "src/face.png"),
				audio: speechAnswer.message.filePath,
			});
			console.log(faceAnswer.message);
			await obsRemoteControl.addVideo((faceAnswer.message as any).filePath);

			//
			// await client.say(target, answer.message.answer);
		} catch (error) {
			console.error(error);
		} finally {
			state.isGenerating = false;
		}
	}
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
	console.log(`* Connected to ${addr}:${port}`);
}

const obsRemoteControl = new OBSRemoteControl({
	password: process.env.OBS_WEBSOCKET_SERVER_PASSWORD,
	defaultVideoPath: process.env.OBS_DEFAULT_VIDEO,
});

await obsRemoteControl.connect();
