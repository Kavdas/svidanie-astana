import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';

type PackageRow = QueryResultRow & {
  id: string;
  title: string;
  price: string | number | null;
  price_amount: string | number | null;
  duration: string | null;
  duration_minutes: number | null;
  prep_minutes: number | null;
  category: string | null;
  category_name: string | null;
  includes: string[] | null;
  note: string | null;
  image_url: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type SiteSettingsRow = QueryResultRow & {
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  instagram_url: string | null;
  whatsapp_phone: string | null;
  kaspi_requisites: string | null;
  kaspi_pay_link: string | null;
};

type GalleryRow = QueryResultRow & {
  id: string;
  title: string | null;
  image_url: string;
  media_type?: string | null;
  sort_order: number | null;
};

@Injectable()
export class CatalogService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getPackages() {
    const result = await this.databaseService.query<PackageRow>(
      `
        select *
        from packages
        where coalesce(is_active, true) = true
          and nullif(trim(title), '') is not null
        order by coalesce(sort_order, 0), title
      `,
    );

    return {
      packages: result.rows.map((item) => ({
        ...item,
        price: item.price == null ? null : String(item.price),
        price_amount: item.price_amount == null ? null : String(item.price_amount),
        includes: Array.isArray(item.includes) ? item.includes : [],
      })),
    };
  }

  async getSiteSettings() {
    const result = await this.databaseService.query<SiteSettingsRow>(
      `
        select hero_title, hero_subtitle, hero_image_url, instagram_url, whatsapp_phone, kaspi_requisites, kaspi_pay_link
        from site_settings
        limit 1
      `,
    );

    return {
      settings: result.rows[0] ?? null,
    };
  }

  async getGallery() {
    const result = await this.databaseService.query<GalleryRow>(
      `
        select *
        from gallery
        where coalesce(is_active, true) = true
          and nullif(trim(image_url), '') is not null
        order by coalesce(sort_order, 0), title
      `,
    );

    return {
      gallery: result.rows,
    };
  }
}
