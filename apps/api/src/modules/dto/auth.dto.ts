import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDtoClass {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class ChangePasswordDtoClass {
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  nextPassword!: string;
}

export class AcceptInviteDtoClass {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class SwitchOrganizationDtoClass {
  @IsString()
  @MinLength(2)
  organizationId!: string;
}
