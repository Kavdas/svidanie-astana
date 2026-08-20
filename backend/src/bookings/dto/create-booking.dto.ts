import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  packageId: string;

  @IsString()
  clientName: string;

  @IsString()
  clientPhone: string;

  @IsDateString()
  startAt: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
