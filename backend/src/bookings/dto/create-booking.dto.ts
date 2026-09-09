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

  // Anti-spam honeypot: a hidden field real visitors never see or fill in.
  // Any non-empty value here means the submitter is a bot.
  @IsOptional()
  @IsString()
  website?: string;

  // Anti-spam timing check: ms-since-epoch timestamp captured client-side
  // when the form first rendered, to catch instant bot submissions.
  @IsOptional()
  @IsString()
  formRenderedAt?: string;
}
