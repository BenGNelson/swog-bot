const { REST, Routes } = require('discord.js');

const config = require('./config.json');

const token = config.token;
const clientId = config.clientId;

const commands = [
  {
    name: '$swog',
    description: 'Swogs',
  },
  {
    name: '$unswog',
    description: 'Unswogs',
  },
  {
    name: '$swog status',
    description: 'Gets swog status',
  },
  {
    name: '$swog help',
    description: 'Displays help',
  },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationCommands(clientId), { body: commands });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
