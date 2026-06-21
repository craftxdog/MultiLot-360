import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { trimLowercaseString } from '../../../../../common';

export class ResendSellerAccessCodeDto {
  @ApiProperty({ example: 'vendedor@example.com' })
  @Transform(({ value }) => trimLowercaseString(value))
  @IsEmail()
  email: string;
}
