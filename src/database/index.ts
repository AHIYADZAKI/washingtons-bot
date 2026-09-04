import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { logger } from '../utils/logger';

let db: Database | null = null;

export async function initializeDatabase(): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database,
  });

  await createTables();
  logger.info('Database initialized successfully');

  return db;
}

async function createTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id TEXT PRIMARY KEY,
      total_messages INTEGER DEFAULT 0,
      total_voice_minutes INTEGER DEFAULT 0,
      weekly_messages INTEGER DEFAULT 0,
      weekly_voice_minutes INTEGER DEFAULT 0,
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      messages INTEGER DEFAULT 0,
      voice_minutes INTEGER DEFAULT 0,
      week_start TIMESTAMP,
      week_end TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user_stats(user_id)
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS birthdays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE,
      birthday_date TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS twitch_streamers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      notification_channel TEXT,
      notification_message TEXT,
      role_id TEXT,
      last_notified BOOLEAN DEFAULT 0,
      last_stream_id TEXT,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS youtube_creators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT UNIQUE,
      channel_name TEXT,
      notification_channel TEXT,
      notification_message TEXT,
      role_id TEXT,
      last_video_id TEXT,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS family_cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      is_occupied BOOLEAN DEFAULT 0,
      occupied_by TEXT,
      occupied_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS family_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      applicant_id TEXT,
      channel_id TEXT,
      status TEXT DEFAULT 'pending',
      answers TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS giveaways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT,
      message_id TEXT,
      prize TEXT,
      winners_count INTEGER,
      description TEXT,
      ended BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      end_at TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id TEXT,
      reported_id TEXT,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      channel_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP
    )
  `);

  // Добавляем недостающие колонки для существующих таблиц (совместимость)
  try {
    await db.exec(`ALTER TABLE twitch_streamers ADD COLUMN last_notified BOOLEAN DEFAULT 0`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE twitch_streamers ADD COLUMN last_stream_id TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE youtube_creators ADD COLUMN last_video_id TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE reports ADD COLUMN channel_id TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE reports ADD COLUMN closed_at TIMESTAMP`);
  } catch (e) {}

  logger.info('All tables created successfully');
}