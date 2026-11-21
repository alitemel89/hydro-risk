import 'reflect-metadata';
import { BadRequestException, Body, Controller, Get, Inject, Injectable, Module, Post, ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { validateArea } from '../../../libs/shared/src/validate-area.mjs';
@Injectable()
class Database {
  readonly pool = new Pool({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000, query_timeout: 5000});
  async onApplicationShutdown() { await this.pool.end(); }
}
@Controller()
class Api {
  constructor(@Inject(Database) private readonly db: Database) {}
  @Get('health') health() { return {status:'ok', service:'hydro-risk', analysisReady:false}; }
  @Get('ready') async ready() {
    try { await this.db.pool.query('SELECT id FROM areas LIMIT 1'); return {status:'ready'}; }
    catch { throw new ServiceUnavailableException('Veritabanı veya migration hazır değil'); }
  }
  @Post('areas') async create(@Body() body: unknown) {
    let input;
    try { input = validateArea(body); } catch(e) { throw new BadRequestException((e as Error).message); }
    const client = await this.db.pool.connect().catch(()=>{throw new ServiceUnavailableException('Veritabanına erişilemiyor');});
    try {
      const result = await client.query(`INSERT INTO areas(id,name,geometry)
        VALUES ($1,$2,ST_SetSRID(ST_GeomFromGeoJSON($3),4326))
        RETURNING id,name,ST_AsGeoJSON(geometry)::json AS geometry,
        ST_Area(geometry::geography)/1000000 AS "areaKm2",created_at AS "createdAt"`,
        [randomUUID(),input.name,JSON.stringify(input.geometry)]);
      return result.rows[0];
    } catch(e) {
      const code = (e as {code?:string}).code;
      if (code === '23514' || code === 'XX000' || code === '22023') throw new BadRequestException('Polygon geçerli olmalı ve alan 0–100 km² arasında olmalı');
      throw new ServiceUnavailableException('Alan kaydedilemedi');
    } finally { client.release(); }
  }
}
@Module({controllers:[Api],providers:[Database]}) class AppModule {}
async function bootstrap() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL gerekli');
  const app = await NestFactory.create(AppModule, {bodyParser:true});
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000), '127.0.0.1');
}
void bootstrap();
