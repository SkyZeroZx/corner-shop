import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { CatalogController } from './catalog.controller';
import { SessionController } from './session.controller';
import { SessionsService } from './sessions.service';

@Module({
  controllers: [SessionController, AccountController, CatalogController],
  providers: [SessionsService],
})
export class AppModule {}
