import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateSessionDtoClass {
  @IsString()
  @MinLength(2)
  title!: string;
}

export class AttachSessionJamDtoClass {
  @IsString()
  gameVersionId!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export { CreateSessionDtoClass as CreateJamDtoClass, AttachSessionJamDtoClass as AttachJamGameDtoClass };

export class CreateTrainerParticipantNoteDtoClass {
  @IsString()
  @MinLength(2)
  body!: string;
}
