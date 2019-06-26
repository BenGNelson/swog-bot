const Discord = require('discord.js');
var config = require('./config.json');

const bot = new Discord.Client();
const token = config.token

var swog = false;

function setSwog(status) {
    swog = status;
}

function activateSwog(message) {
    var number = Math.floor(Math.random() * 100);

    if (number < 5) {
        message.channel.send("Swog unsuccessful. Please swog harder.");
    } else {
        message.channel.send("Swog activated.");
        message.channel.send("Swog");
        setSwog(true);
        console.log("Swog status: " + swog);
    }
}

function deactivateSwog(message) {
    message.channel.send("Swog deactivated.");
    setSwog(false);
    console.log("Swog status: " + swog);
}

bot.on('message', function(message)
{
    switch(message.content){

        //swog
        case '!swog':
        if (!swog) {
            activateSwog(message);
        } else {
            message.channel.send("Swog is already activated.");
        }
        break;

        //unswog
        case '!unswog':
        if (!swog) {
            message.channel.send("Swog is already deactivated.");
        } else {
            deactivateSwog(message);
        }
        break;

        //swog status
        case '!swog status':
        if (swog) {
            message.channel.send("Swog is active.");
        } else {
            message.channel.send("Swog is not active. Type !swog to activate swog.");
        }
        break;

        //swog help
        case '!swog help':
        message.channel.send({embed: {
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

bot.on('ready', function(){
    console.log("Bot launched...");
    bot.user.setActivity('Swog: The Game');
});

bot.login(token);
