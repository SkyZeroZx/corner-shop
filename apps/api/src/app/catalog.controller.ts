import {
  Controller,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { CAMPAIGN_DEALS_URL } from './config';
import { PRODUCTS, PROMOS } from './data';
import { SessionGuard, XsrfGuard } from './guards';

@Controller()
export class CatalogController {
  @Get('products')
  @Header('Cache-Control', 'public, max-age=60')
  products() {
    return PRODUCTS;
  }

  @Get('promos')
  promos() {
    return PROMOS;
  }

  @Post('promos/:id/save')
  @UseGuards(SessionGuard, XsrfGuard)
  @HttpCode(204)
  savePromo(@Param('id') id: string) {
    if (!PROMOS.some((promo) => promo.id === id)) {
      throw new NotFoundException();
    }
  }

  /** Left over from the campaign: the deals live on the campaign site. */
  @Get('deals/today')
  @Redirect(CAMPAIGN_DEALS_URL, 302)
  dealsOfTheDay() {
    // @Redirect is the whole response.
  }
}
