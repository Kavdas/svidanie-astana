import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('packages')
  getPackages() {
    return this.catalogService.getPackages();
  }

  @Get('site-settings')
  getSiteSettings() {
    return this.catalogService.getSiteSettings();
  }

  @Get('gallery')
  getGallery() {
    return this.catalogService.getGallery();
  }
}
