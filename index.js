// Twitch API Docs: https://github.com/tmijs/tmi.js

//
// Require components
//
require('dotenv/config');
const tmi = require('tmi.js');
const fs = require('fs');

//
// Global variables
//
const prefix = "!";

// Game properties
var maxSubmits = 2;
var MaxSubmitCharLength = 30;
var promptListSize = 25;

var subOpen = false;
var submitsThisRound = 0;

// Lists
var promptList = [];
var submitLog = [];
var banList = [];

// File vars
const promptFileName = "prompts";
const banFileName = "banlist";
const sublogFileName = "sublog_"
const logDir = "./userlogs";
const fileExt = ".txt";
var fileDate = "01-01-2021_12-00am";

// User list
var chatUsers = [];
function ChatUser(uName) {
    this.userName = uName || "Fake User";
    this.timesSubmitted = 0; // Used to check if users have reached their submit limit
    this.banned = false; // Used to block users from submitting prompts if they have a questionable history
    this.prompts = []; // This could be used for credits or something
}

//
// Bot Connection Settings
//
const client = new tmi.Client({
	options: { debug: true, messagesLogLevel: "info" },
	connection: {
		reconnect: true,
		secure: true
	},
	identity: {
		username: process.env.TWITCH_BOTNAME,
		password: process.env.OAUTH_CODE
	},
	channels: [ process.env.TWITCH_CHANNEL ]
});

// This line, connects us to the Twitch chat
client.connect().catch(console.error);


//
// When a user sends a message in the chat
//
client.on('message', (channel, tags, message, self) => {
    // If the bot is sending the message or no prefix, do nothing
    if (!message.startsWith(prefix) || self) return;

    // Get arguemnts and command from message
    // In "!submit explode": "!" is the prefix, "submit" is the command, "explode" is arg[0]
    const args = message.slice(prefix.length).trim().split(" ");
    const command = args.shift().toLowerCase();

    // The mention for the user sending a message
    const mentionMe = "@" + tags.username;

    // Get the user's mod status
    let isMod = tags.mod || tags['user-type'] === 'mod';
    let isBroadcaster = channel.slice(1) === tags.username;
    let IAmAMod = isMod || isBroadcaster;

    //
    // If the command matches any of the available commands, run the function
    //
    var commandFound = false;
    for (const [key, value] of Object.entries(BotCommands)) {
        for (var i = 0; i < BotCommands[key].commands.length; i++) {
            // if command is found, exicute it
            if (command === BotCommands[key].commands[i] && !commandFound) {
                commandFound = true;
                // If mod is required
                if (BotCommands[key].mod) {
                    if (IAmAMod) BotCommands[key].function(client, channel, tags, message, self, mentionMe, args, IAmAMod);
                }
                // If no Mod is required
                else BotCommands[key].function(client, channel, tags, message, self, mentionMe, args, IAmAMod);
            }
            if (commandFound) break;
        }
        if (commandFound) break;
    }

    if (!commandFound) {
        client.say(channel, `"${prefix}${command}" is not a valid command. Type "${prefix}${BotCommands.help.commands[0]}" for a the list of all commands.`);
    }
});

//
// Bot Commands
//
const BotCommands = {
    /*
    Still needs to be implemented:

    !loadbanlist    - Loads the "./banlist.txt" file (if the file exists) and appends to the banList array
    */

    //
    // All user commands
    //
    help: {
        commands: ["help"],
        mod: false,
        description: "Displays the available commands.",
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // List all commands
            client.say(channel, `Commands:`);
            // The user is a Mod
            if (IAmAMod){
                for (const [key, value] of Object.entries(BotCommands)) {
                    if (BotCommands[key].mod) client.say(channel, `${prefix}${BotCommands[key].commands[0]} (Mods only) - ${BotCommands[key].description}`);
                    else client.say(channel, `${prefix}${BotCommands[key].commands[0]} - ${BotCommands[key].description}`);
                }
            }
            // The user is not a Mod
            else {
                for (const [key, value] of Object.entries(BotCommands)) {
                    if (!BotCommands[key].mod) client.say(channel, `${prefix}${BotCommands[key].commands[0]} - ${BotCommands[key].description}`);
                }
            }
        }
    },
    bot: {
        commands: ["bot", "botabout"],
        mod: false,
        description: "Displays information about this bot.",
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Explain this bot
            client.say(channel, mentionMe + `, Hi, I'm a bot made by @CaperCube to help Twitch viewers submit prompts to streamer's Frame Game sessions.`);
        }
    },
    about: {
        commands: ["about", "game", "fg"],
        mod: false,
        description: "Displays information about Frame Game.",
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Show info about Frame Game
            client.say(channel, `There's supposed to be links to Frame Game and stuff here...`);
        }
    },
    submit: {
        commands: ["submit", "sub"],
        mod: false,
        description: `Submits the given prompt to the list, if you are allowed. (example: "${prefix}submit explode" will submit "explode" to the prompt list.)`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Check if submissions are open
            if (subOpen) {
                // Get time of submit
                const timeNow = GetNowTime();

                // Get submission
                var sub = "";
                for (var i = 0; i < args.length; i++) {
                    if (i > 0) sub += " ";
                    sub += args[i]
                }

                // Create a ChatUser if they're not already there
                var chatU = SearchListByName(tags.username);
                if (chatU == null) {
                    chatU = new ChatUser(tags.username);
                    chatUsers.push(chatU);
                }

                // The user is a Mod
                if (IAmAMod) {
                    if (sub.length <= MaxSubmitCharLength) {
                        // Try to add to list
                        const dupEntry = SubmitPrompt(sub, chatU);
                        if (dupEntry) client.say(channel, `${mentionMe} this entry already exists, try again.`);
                        else {
                            // Use up one of this user's submissions
                            chatU.timesSubmitted++;

                            if ((promptListSize - submitsThisRound) <= 0) client.say(channel, `${mentionMe} has submitted "${sub}". Prompt submissions now closed!`);
                            else client.say(channel, `${mentionMe} has submitted "${sub}". ${promptListSize - submitsThisRound} prompts left!`);   

                            // Add to log
                            LogSubmission(mentionMe, timeNow, sub, IAmAMod);
                        }
                    }
                    else {
                        // The prompt is too long
                        client.say(channel, `${mentionMe} this prompt is too long. The limit is ${MaxSubmitCharLength} characters.`);
                    }
                }
                // The user is not a Mod
                else {
                    // Has the user already submitted the max amount of times?
                    if (chatU.timesSubmitted < maxSubmits) {
                        // Is the user not banned?
                        if (!chatU.banned) {
                            // Is the word short enough?
                            if (sub.length <= MaxSubmitCharLength) {
                                // Try to add to list
                                const dupEntry = SubmitPrompt(sub, chatU);
                                if (dupEntry) client.say(channel, `${mentionMe} this entry already exists, try again.`);
                                else {
                                    // Use up one of this user's submissions
                                    chatU.timesSubmitted++;

                                    if ((promptListSize - submitsThisRound) <= 0) client.say(channel, `${mentionMe} has submitted "${sub}". Prompt submissions now closed!`);
                                    else client.say(channel, `${mentionMe} has submitted "${sub}". ${promptListSize - submitsThisRound} prompts left!`);  
                                    
                                    // Add to log
                                    LogSubmission(mentionMe, timeNow, sub, IAmAMod);
                                }
                            }
                            else {
                                // The prompt is too long
                                client.say(channel, `${mentionMe} this prompt is too long. The limit is ${MaxSubmitCharLength} characters.`);
                            }
                        }
                        else {
                            // This user is banned and cannot submit
                            client.say(channel, `${mentionMe} You are not currently allowed to submit prompts.`);
                        }
                    }
                    else {
                        // This user has used all their submits
                        client.say(channel, `${mentionMe} You have submitted the max number of times for this round.`);
                    }
                }
                // Close if limit is reached
                if ((promptListSize - submitsThisRound) <= 0) {
                    // Close submissions
                    subOpen = false;
                    // Save files
                    console.log(promptList);
                    ExportFile(promptList, promptFileName + fileExt);
                    ExportFile(submitLog, sublogFileName + fileDate + fileExt, logDir);
                }
            }
            else {
                // Submissions are closed
                client.say(channel, `Prompt submissions are currently closed. Please wait for them to open again.`);
            }
        }
    },
    //
    // Mod only commands
    //
    open: {
        commands: ["open"],
        mod: true,
        description: `Opens the prompt submission window for [n] unique prompts. (example: "${prefix}open 25" will open submissions for up to 25 prompts)`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Open submissions
            if (args[0] != undefined && parseInt(args[0]) > 0) promptListSize = parseInt(args[0]);
            subOpen = true;

            // Reset user submit counters
            ResetSubmitCounters();

            client.say(channel, `Submissions for prompts are now open! ${promptListSize} prompts will will accepted.`);
        }
    },
    close: {
        commands: ["close"],
        mod: true,
        description: `Closes the prompt submission window.`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Close submissions
            subOpen = false;
            
            // Save out the text list
            console.log(promptList);
            ExportFile(promptList, promptFileName + fileExt);
            ExportFile(submitLog, sublogFileName + fileDate + fileExt, logDir);

            client.say(channel, `Submissions window is now closed. Any more submissions will now be denied.`);
        }
    },
    clear: {
        commands: ["clear", "clearprompts"],
        mod: true,
        description: `Clears the prompt list.`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Clear list
            promptList = [];

            // Reset user submit counters
            ResetSubmitCounters();

            client.say(channel, `Prompt list has been reset.`);
        }
    },
    listlength: {
        commands: ["listlength", "listlen", "llen"],
        mod: true,
        description: `Sets the prompt submission limit. (Example: "${prefix}listlength 5" will prevent any more than 5 total prompts from being submitted)`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Set limit
            if (args[0] != undefined && parseInt(args[0]) > 0) {
                promptListSize = parseInt(args[0]);
                client.say(channel, `Prompt submission limit has been set to ${promptListSize}.`);
            }
            // The user put in an invalid argument
            else {
                client.say(channel, `Invalid command. Try something like "${prefix}listlength 25"`);
            }
        }
    },
    charLimit: {
        commands: ["charlimit", "charlim", "clim"],
        mod: true,
        description: `Sets the prompt character limit. (Example: "${prefix}promptlength 20" will make all prompts longer than 20 characters invalid)`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Set limit
            if (args[0] != undefined && parseInt(args[0]) > 0) {
                MaxSubmitCharLength = parseInt(args[0]);
                client.say(channel, `Prompt character limit has been set to ${MaxSubmitCharLength}.`);
            }
            // The user put in an invalid argument
            else {
                client.say(channel, `Invalid command. Try something like "${prefix}promptlength 20"`);
            }
        }
    },
    userLimit: {
        commands: ["userlimit", "userlim", "ulim"],
        mod: true,
        description: `Sets the maximum prompts a user can submit. (Example: "${prefix}promptlimit 5" sets the prompt limit to 5)`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Set limit
            if (args[0] != undefined && parseInt(args[0]) > 0) {
                maxSubmits = parseInt(args[0]);
                client.say(channel, `User's prompt submission limit has been set to ${maxSubmits}.`);
            }
            // The user put in an invalid argument
            else {
                client.say(channel, `Invalid command. Try something like "${prefix}promptlimit 2"`);
            }
        }
    },
    ban: {
        commands: ["ban", "banuser", "userban"],
        mod: true,
        description: `Bans the designated user from submitting prompts. (Example: "${prefix}ban userName" bans the user with name "userName")`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            if (args[0] != undefined) {
                // Find user
                var u = SearchListByName(args[0]);
                console.log(args[0]);
                console.log(u);
                // If the user exists, ban them
                if (u != null) {
                    // Ban
                    u.banned = true;
                    // Add to the ban list
                    if (!banList.includes(args[0])) banList.push(args[0]);

                    client.say(channel, `User "${args[0]}" has been banned from submitting prompts.`);
                }
                // If the user does not exist, create them, and ban them
                else {
                    chatU = new ChatUser(args[0]);
                    chatUsers.banned = true;
                    chatUsers.push(chatU);

                    // Add to the ban list
                    if (!banList.includes(args[0])) banList.push(args[0]);

                    client.say(channel, `User "${args[0]}" has been banned from submitting prompts.`);
                }

                // Save ban list
                ExportFile(banList, banFileName + fileExt);
            }
            // The user put in an invalid argument
            else {
                client.say(channel, `Invalid command. Try something like "${prefix}ban fred"`);
            }
        }
    },
    unban: {
        commands: ["unban", "unbanuser", "userunban"],
        mod: true,
        description: `Unbans the designated user. This allows them to submit prompts again. (Example: "${prefix}unban userName" unbans the user with name "userName")`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            if (args[0] != undefined) {
                // Find user
                var u = SearchListByName(args[0]);
                console.log(args[0]);
                console.log(u);
                // If the user exists, unban them
                if (u != null) {
                    // Unban
                    u.banned = false;
                    // Remove from ban list
                    if (banList.includes(args[0])) banList.splice(banList.indexOf(args[0]), 1);

                    client.say(channel, `User "${args[0]}" has been unbanned and can submit prompts again. Good job!`);
                }
                // If the user does not exist, tell us
                else {
                    client.say(channel, `Cannot find user to unban.`);
                }

                // Save ban list
                ExportFile(banList, banFileName + fileExt);
            }
            // The user put in an invalid argument
            else {
                client.say(channel, `Invalid command. Try something like "${prefix}unban fred"`);
            }
        }
    },
    clearban: {
        commands: ["clearban", "unbanall"],
        mod: true,
        description: `Unbans all users. This allows them to submit prompts again.`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Loop through all users and remove their ban status
            for (var i = 0; i < banList.length; i++) {
                SearchListByName(banList[i]).banned = false;
            }

            // Clear banlist
            banList = [];

            // Save ban list
            ExportFile(banList, banFileName + fileExt);

            client.say(channel, `All users have been unbanned`);
        }
    },
    //
    // Save / Load commands
    //
    savePrompts: {
        commands: ["saveprompts", "savep"],
        mod: true,
        description: `Saves the "./${promptFileName}${fileExt}" file with all the prompts in it`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Save file
            ExportFile(promptList, promptFileName + fileExt);

            client.say(channel, `Prompts have been saved.`);
        }
    },
    saveLog: {
        commands: ["savelog", "savel"],
        mod: true,
        description: `Saves the "./${sublogFileName}${fileExt}" file with the submission log in it.`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Save file
            ExportFile(submitLog, sublogFileName + fileDate + fileExt, logDir);

            client.say(channel, `Submission log has been saved.`);
        }
    },
    saveBan: {
        commands: ["saveban", "saveb"],
        mod: true,
        description: `Saves the "./${banFileName}${fileExt}" file with the banned users in it.`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Save file
            ExportFile(banList, banFileName + fileExt);

            client.say(channel, `Ban list has been saved.`);
        }
    },
    loadPrompts: {
        commands: ["loadprompts", "loadp"],
        mod: true,
        description: `Loads the "./${promptFileName}${fileExt}" file and appends it to the prompt list.`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Load file
            if (fs.existsSync(promptFileName + fileExt)){
                ImportFile(promptFileName + fileExt, promptList);
                client.say(channel, `Prompt list has been loaded.`);
            }
            else {
                client.say(channel, `"./${promptFileName}${fileExt}" cannot be found.`);
            }
        }
    }/*,
    loadBan: {
        commands: ["loadban", "loadb"],
        mod: true,
        description: `Loads the "./${banFileName}${fileExt}" file and appends it to the ban list.`,
        function: function(client, channel, tags, message, self, mentionMe, args, IAmAMod) {
            // Load file
            if (fs.existsSync(banFileName + fileExt)){
                ImportFile(banFileName + fileExt, banList);

                // Create ChatUser()s out of the list

                client.say(channel, `Ban list has been loaded.`);
            }
            else {
                client.say(channel, `"./${banFileName}${fileExt}" cannot be found.`);
            }
        }
    }
    */
};

//
// Utility functions
//

// Returns the current time, formatted as: "Monday 5:30pm 3 Jan 2021"
function GetNowTime() {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const d = new Date();
    const day = days[d.getDay()];
    var hr = d.getHours();
    var min = d.getMinutes();
    if (min < 10) {
        min = "0" + min;
    }
    var ampm = "am";
    if( hr > 12 ) {
        hr -= 12;
        ampm = "pm";
    }
    const date = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    // Set file date for the sublog
    fileDate = `${d.getMonth() + 1}-${date}-${year}_${hr}-${min}${ampm}`;

    // Return the date
    return `${day} ${hr}:${min}${ampm} ${date} ${month} ${year}`;
}

// Returns a user if they've submitted before. Returns null if they haven't.
function SearchListByName(uName) {
    for (var i = 0; i < chatUsers.length; i++) {
        if (chatUsers[i].userName == uName) {
            return chatUsers[i];
        }
    }
    return null;
}

// Resets all user submit counters
function ResetSubmitCounters() {
    for (u in chatUsers) {
        if (u.userName === uName && chatUser == null) {
            chatUser = u;
            u.timesSubmitted = 0;
        }
    }

    submitsThisRound = 0;
}

// Places prompt into the list, if it doens't already exist
function SubmitPrompt(newPrompt, user) {
    // Check to see if the list already has one of these
    for (var i = 0; i < promptList.length; i++) {
        if (promptList[i].toLowerCase() === newPrompt.toLowerCase()) {
            return true;
        }
    }

    // If no duplicate, submit it
    promptList.push(newPrompt);

    // Log this prompt under the ChatUser object
    user.prompts.push(newPrompt);

    // Tick up the total submits this round
    submitsThisRound++;

    return false;
}

// Submission log
function LogSubmission(name, time, sub, mod) {
    // Add this to the submission log array
    if (mod) submitLog.push(`user: ${name}(MOD) | time: ${time} | submit: ${sub}`);
    else submitLog.push(`user: ${name} | time: ${time} | submit: ${sub}`);
}

// Exports the given array as a text file 
function ExportFile(stringArray, fName, dir) {
    // Get dir
    var fileDir = dir || "";
    
    // Format array for text file
    var saveData = "";
    for (var i = 0; i < stringArray.length; i++) {
        if (i === 0) saveData += stringArray[i];
        else saveData += `\n${stringArray[i]}`;
    }

    // Save file
    if (fileDir != "") {
        // Create directory if it doesn't exist
        if (!fs.existsSync(fileDir)){
            fs.mkdirSync(fileDir);
        }
        // Write file to directory
        fs.writeFile(`${fileDir}/${fName}`, saveData, function(err, data){
            if (err) {
                return console.log(err);
            }
        });
    }
    else {
        // Write file
        fs.writeFile(`./${fName}`, saveData, function(err, data){
            if (err) {
                return console.log(err);
            }
        });
    }
}

// Imports the given file as a string array
function ImportFile(fName, outputArray) {
    // Read entire file and split it up
    fs.readFile(fName, function(err, data) {
        if(err) throw err;
        var array = data.toString().split("\n");
        for(i in array) {
            // Append each line to array
            outputArray.push(array[i]);
        }

        console.log(`File ${fName} has finished loading.`);
        console.log(outputArray);
    });
}