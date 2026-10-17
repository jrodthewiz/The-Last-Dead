import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const coopRooms=sqliteTable('coop_rooms',{
 code:text('code').primaryKey(),name:text('name').notNull(),hostName:text('host_name').notNull(),hostToken:text('host_token').notNull(),hostSeen:integer('host_seen').notNull(),hostJson:text('host_json').notNull().default('{}'),guestName:text('guest_name').notNull().default(''),guestToken:text('guest_token'),guestSeen:integer('guest_seen').notNull().default(0),guestJson:text('guest_json').notNull().default('{}'),status:text('status').notNull().default('waiting')
});
