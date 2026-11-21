import { sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
export const areas = sqliteTable('areas', {
 id: text('id').primaryKey(),
 name: text('name').notNull(),
 geometry: text('geometry').notNull(),
 areaKm2: real('area_km2').notNull(),
 createdAt: text('created_at').notNull(),
});
export const monitors = sqliteTable('monitors', {
 id: text('id').primaryKey(),name: text('name').notNull(),geometry: text('geometry').notNull(),areaKm2: real('area_km2').notNull(),parameters: text('parameters').notNull(),result: text('result'),updatedAt: text('updated_at'),lastError: text('last_error'),enabled: real('enabled').notNull().default(1),createdAt: text('created_at').notNull(),
});
