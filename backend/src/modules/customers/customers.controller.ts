import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

type AuthenticatedRequest = {
  user?: {
    organizationId?: string;
  };
};

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() createCustomerDto: CreateCustomerDto,
  ) {
    const customer = await this.customersService.create(createCustomerDto, req.user);
    return { customer };
  }

  @Get()
  async findAll(@Req() req: AuthenticatedRequest, @Query('search') search?: string) {
    if (search) {
      const customers = await this.customersService.search(search, req.user);
      return { customers };
    }
    const customers = await this.customersService.findAll(req.user);
    return { customers };
  }

  @Get(':id')
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const customer = await this.customersService.findOne(id, req.user);
    return { customer };
  }

  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    const customer = await this.customersService.update(
      id,
      updateCustomerDto,
      req.user,
    );
    return { customer };
  }

  @Delete(':id')
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.customersService.remove(id, req.user);
    return { success: true, message: 'Customer deleted' };
  }
}
