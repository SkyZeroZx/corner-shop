import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AttackerController } from './attacker.controller';
import { CaptureMiddleware } from './capture.middleware';
import { CapturesService } from './captures.service';

@Module({
  controllers: [AttackerController],
  providers: [CapturesService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CaptureMiddleware).exclude('__log').forRoutes('*path');
  }
}
