import { IsUUID, Matches } from 'class-validator';

export class AvailableSlotsDto {
  @IsUUID()
  packageId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;
}
