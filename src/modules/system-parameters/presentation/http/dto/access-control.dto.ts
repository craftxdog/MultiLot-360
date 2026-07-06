import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { trimString } from '../../../../../common';

const normalizeModuleCode = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class ListAccessQueryDto {
  @ApiPropertyOptional({ example: 'ventas' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateAccessRoleDto {
  @ApiProperty({ example: 'supervisor' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[\p{L}\p{N} _.-]+$/u)
  name: string;
}

export class AccessPermissionInputDto {
  @ApiProperty({ example: 'TURNOS' })
  @Transform(({ value }) => normalizeModuleCode(value))
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  moduleCode: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  canRead: boolean;

  @ApiProperty({ default: false })
  @IsBoolean()
  canCreate: boolean;

  @ApiProperty({ default: false })
  @IsBoolean()
  canUpdate: boolean;

  @ApiProperty({ default: false })
  @IsBoolean()
  canDelete: boolean;
}

export class ReplaceAccessRolePermissionsDto {
  @ApiProperty({ type: [AccessPermissionInputDto] })
  @IsArray()
  @ArrayUnique((permission: AccessPermissionInputDto) => permission.moduleCode)
  @ValidateNested({ each: true })
  @Type(() => AccessPermissionInputDto)
  permissions: AccessPermissionInputDto[];
}

export class AssignUserRoleDto {
  @ApiProperty()
  @IsUUID()
  roleId: string;
}

export class AccessModuleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty()
  roleCount: number;
}

export class AccessPermissionResponseDto extends AccessPermissionInputDto {
  @ApiProperty()
  moduleId: string;

  @ApiProperty({ nullable: true })
  moduleDescription: string | null;
}

export class AccessRoleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  userCount: number;

  @ApiProperty({ type: [AccessPermissionResponseDto] })
  permissions: AccessPermissionResponseDto[];
}

export class AccessUserRoleResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty()
  roleId: string;

  @ApiProperty()
  roleName: string;

  @ApiProperty()
  updatedAt: Date;
}
