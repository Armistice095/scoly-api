import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { EquipeService } from './equipe.service.js';
import { AccepterInvitationDto } from './dto/accepter-invitation.dto.js';

@Controller('invitation')
export class InvitationController {
  constructor(private readonly equipeService: EquipeService) {}

  @Get()
  consulter(@Query('id') id: string, @Query('token') token: string) {
    return this.equipeService.consulterInvitation(id, token);
  }

  @Post('accepter')
  @HttpCode(HttpStatus.OK)
  accepter(@Body() dto: AccepterInvitationDto) {
    return this.equipeService.accepterInvitation(dto);
  }
}
