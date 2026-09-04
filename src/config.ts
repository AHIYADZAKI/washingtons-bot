import dotenv from 'dotenv';

dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN || '',
  databasePath: process.env.DATABASE_PATH || './database.sqlite',
  prefix: '!',
  owners: ['YOUR_USER_ID'],
  guildId: 'YOUR_GUILD_ID',
  moderation: {
    maxMessages: 5,
    timeWindow: 5000,
  },
  family: {
    roleId: process.env.FAMILY_ROLE_ID || 'FAMILY_ROLE_ID',
    inactiveRoleId: process.env.INACTIVE_ROLE_ID || 'INACTIVE_ROLE_ID',
  },
  birthdayChannelId: process.env.BIRTHDAY_CHANNEL_ID || '', // ID канала для поздравлений
};