import { IsString, MinLength } from "class-validator";

export class JoinSessionDtoClass {
  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsString()
  @MinLength(1)
  avatar!: string;
}

export class SelectJamDtoClass {
  @IsString()
  gameVersionId!: string;
}

export { JoinSessionDtoClass as JoinJamDtoClass, SelectJamDtoClass as SelectGameDtoClass };

