const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const config = require('./config.json');

const token = config.token

var swog = false;

function setSwog(status) {
    swog = status;
}

async function activateSwog(message, interaction) {
    var number = Math.floor(Math.random() * 100);

    if (number < 5) {
        await interaction.reply("Swog unsuccessful. Please swog harder.");
    } else {
        await interaction.reply("Swog activated.");
        await interaction.reply("Swog");
        setSwog(true);
        console.log("Swog status: " + swog);
    }
}

async function deactivateSwog(message, interaction) {
    await interaction.reply("Swog deactivated.");
    setSwog(false);
    console.log("Swog status: " + swog);
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    switch(interaction.commandName){

        //swog
        case '!swog':
        if (!swog) {
            activateSwog(message, interaction);
        } else {
            await interaction.reply("Swog is already activated.");
        }
        break;

        //unswog
        case '!unswog':
        if (!swog) {
            await interaction.reply("Swog is already deactivated.");
        } else {
            deactivateSwog(message, interaction);
        }
        break;

        //swog status
        case '!swog status':
        if (swog) {
            await interaction.reply("Swog is active.");
        } else {
            await interaction.reply("Swog is not active. Type !swog to activate swog.");
        }
        break;

        //swog help
        case '!swog help':
        await interaction.reply({embed: {
            color: 3447003,
            title: "Swog Bot Options:",
            fields: [
              { name: "Command", value: "!swog\n!unswog\n!swog status", inline: true},
              { name: "Description", value: "Activates swog\nDeactivates swog\nChecks the swog status", inline: true},
            ]
          }
        });
    }
});

client.on('ready', () => {
    console.log("Bot launched...");
    client.user.setActivity('Swog: The Game');
});

client.login(token);
