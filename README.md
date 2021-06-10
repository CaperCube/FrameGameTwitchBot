     ______                         _____                      
    |  ____|                       / ____|                     
    | |__ _ __ __ _ _ __ ___   ___| |  __  __ _ _ __ ___   ___ 
    |  __| `__/ _' | '_ ` _ \ / _ \ | |_ |/ _' | '_ ` _ \ / _ \
    | |  | | | (_| | | | | | |  __/ |__| | (_| | | | | | |  __/
    |_|  |_|  \__,_|_| |_| |_|\___|\_____|\__,_|_| |_| |_|\___|

# Frame Game Twitch Chat Bot
* Code by CaperCube
* v0.1
-----------------------------------------------------------
## Description:

This is a node.js Twitch chat bot that allows your Twitch
viewers to submit prompts to a text file on your computer.
The idea being that you can then open that file and remove
offensive prompts and then use that file in your next round
of Frame Game.
 
If you're feeling lucky, you could change this bot so it
overwrites the "FrameGame_Data\StreamingAssets\prompts.txt"
file in your FrameGame directory, but I wouldn't reccomend
that. Sounds like a Twitch ban waiting to happen.

Feel free to modify this code however you like!

-----------------------------------------------------------
# WARNING:

Be cautious of using any code you recive from unknown sources.
Node.js applications can be harmful if modified by those with
malicious intent.

-----------------------------------------------------------
## Setup:

Here's some beginner / intermediate level instructions to get this bot up and running:

1. Install dev environment (I like VSCode)
2. Install Node.js on your system
3. Create a directory on your system to contain this bot app
4. npm init your app and take note of the app entry name (i.e. `index.js`)
5. Paste this code into the app entry file (i.e. `index.js`)
6. The project requires `tmi.js` and `dotenv` so run the command `npm install` (see step 10 for running terminal commands)
7. Crate a file called `.env` in the bot's root directory (wherever your `index.html` file is)
8. Obtain your OAuth code here at [twitchapps](https://twitchapps.com/tmi/)
    * **!!WARNING!!**  THIS OAUTH CODE GIVES PERMISSIONS TO YOUR TWITCH ACCOUNT!! DO NOT SHOW THIS TO ANYONE! I mean, unless you really trust them or something, but it's best if you don't.
9. Fill in the `.env` file like so: (replace everything in [] with your info)
    * `TWITCH_CHANNEL = [your-twitch-username]`
    * `TWITCH_BOTNAME = [Your-Bots-Name]`
    * `OAUTH_CODE = [oauth:******************************]`
10. (If Using VSCode) Click *Terminal > New Terminal* in the top bar, type `node .` in the terminal, and hit enter to start the bot
11. Close VSCode or click in the terminal and press `Ctrl + c` to stop the bot

-----------------------------------------------------------
## How to use:

Viewers and mods in your Twitch chat can use chat commands
to operate this bot. Here are the commands:

#### Chat Commands:

    !submit [p]     - If submissions are open, this will submit a prompt [p] to the list (if that prompt doesn't already exist)
    !help           - Prints commands excluding mod commands to the chat. If a mod uses this command, it will print all commands.
    !about      	- Prints info about Frame Game to the chat
    !bot            - Prints info about the bot to the chat
    
#### Mod only Chat Commands:
    !open [n]       - Opens the prompt submission window for [n] unique prompts. Submissions will close once 25 prompts are submitted. This also resets each viewer's submittion count ([n] is an optional prompt, if not present, will use current value)
    !close          - Manully closes the submissions and saves to a text file
    !clear          - Clears all prompts in the prompt list
    !ban [u]        - Finds ChatUser with name [u] and flags them as banned, also adds them to the banList, then saves the banlist file
    !unban [u]      - Finds ChatUser with name [u] un-bans them, also removes them from the banList, then saves the banlist file
    !clearban       - Unbans all users and saves the banlist file
    
    !userlimit [n]  - Adjusts how many prompts [n] each user con submit per window
    !charlimit [n]  - Adjusts prompt character limit
    !listlength [n] - Adjusts submission list length

    !saveprompts    - Saves a .txt file with all the prompts in it
    !savelog        - Saves a .txt file in "./userlogs/" with the prompt submit logs from this session
    !saveban        - Saves a .txt file with all banned users

    !loadprompts    - Loads the "./prompts.txt" file (if the file exists) and appends to the prompt array
    (Not done yet)  - need to change so it creates new users from the loaded list, and doesn't create duplicate users
    !loadbanlist    - Loads the "./banlist.txt" file (if the file exists) and appends to the banList array

# Have fun!