import {integer,sqliteTable,text,index} from 'drizzle-orm/sqlite-core';

export const watchedGames=sqliteTable('watched_games',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),gameId:text('game_id').notNull(),
 date:text('date').notNull(),day:text('day').notNull(),away:text('away').notNull(),home:text('home').notNull(),
 awayScore:integer('away_score'),homeScore:integer('home_score'),mood:text('mood'),note:text('note').notNull().default(''),
 updatedAt:text('updated_at').notNull(),
},table=>[index('watched_user_day').on(table.userId,table.day)]);

export const diaries=sqliteTable('diaries',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),period:text('period').notNull(),
 from:text('from_day').notNull(),to:text('to_day').notNull(),text:text('body').notNull(),
 gameIds:text('game_ids').notNull(),createdAt:text('created_at').notNull(),source:text('source').notNull(),
},table=>[index('diaries_user_period').on(table.userId,table.period,table.from)]);

export const journalSettings=sqliteTable('journal_settings',{
 userId:text('user_id').primaryKey(),frequency:text('frequency').notNull().default('week'),
 autoEnabled:integer('auto_enabled',{mode:'boolean'}).notNull().default(true),
 updatedAt:text('updated_at').notNull(),
});
