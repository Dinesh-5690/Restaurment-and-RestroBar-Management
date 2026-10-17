import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.userRepo.findOne({ where: { username: dto.username } });
    if (exists) throw new ConflictException('Username already taken');
    const hashed = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({ ...dto, password: hashed });
    return this.userRepo.save(user);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { username } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({
      select: [
        'id',
        'username',
        'name',
        'role',
        'isActive',
        'salaryType',
        'salaryAmount',
        'accessRights',
        'basicDetails',
        'createdAt',
      ],
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (dto.username && dto.username !== user.username) {
      const exists = await this.userRepo.findOne({ where: { username: dto.username } });
      if (exists) throw new ConflictException('Username already taken');
    }

    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 12);
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.salaryType !== undefined) user.salaryType = dto.salaryType;
    if (dto.salaryAmount !== undefined) user.salaryAmount = dto.salaryAmount;
    if (dto.accessRights !== undefined) user.accessRights = dto.accessRights;
    if (dto.basicDetails !== undefined) user.basicDetails = dto.basicDetails;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.username !== undefined) user.username = dto.username;

    return this.userRepo.save(user);
  }

  async seedAdmin(): Promise<void> {
    const exists = await this.userRepo.findOne({ where: { username: 'admin' } });
    if (!exists) {
      await this.create({ username: 'admin', password: 'admin123', name: 'Administrator', role: 'ADMIN' as any });
    }
  }
}
