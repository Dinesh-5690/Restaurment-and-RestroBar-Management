import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import {
  CreateReservationDto,
  UpdateReservationDto,
} from './dto/reservation.dto';
import { ReservationStatus } from '../common/enums';
import { Table } from '../tables/entities/table.entity';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
  ) {}

  async create(dto: CreateReservationDto): Promise<Reservation> {
    const reservation = this.reservationRepo.create({
      ...dto,
      customerName: dto.customerName.trim(),
      customerPhone: dto.customerPhone?.trim() || null,
      reservationDate: dto.reservationDate,
      reservationTime: dto.reservationTime,
      notes: dto.notes?.trim() || null,
      specialRequest: dto.specialRequest?.trim() || null,
      createdBy: dto.createdBy?.trim() || null,
      status: dto.status ?? ReservationStatus.PENDING,
    });

    await this.attachTableDetails(reservation, dto.tableId);
    await this.ensureNoTableConflict(reservation);

    return this.reservationRepo.save(reservation);
  }

  async findAll(params: {
    from?: string;
    to?: string;
    status?: ReservationStatus | 'ALL';
    tableId?: string;
    search?: string;
  }): Promise<Reservation[]> {
    const { from, to, status = 'ALL', tableId, search } = params;

    const query = this.reservationRepo
      .createQueryBuilder('reservation')
      .orderBy('reservation.reservationDate', 'ASC')
      .addOrderBy('reservation.reservationTime', 'ASC')
      .addOrderBy('reservation.createdAt', 'DESC');

    if (from) query.andWhere('reservation.reservationDate >= :from', { from });
    if (to) query.andWhere('reservation.reservationDate <= :to', { to });
    if (status !== 'ALL') query.andWhere('reservation.status = :status', { status });
    if (tableId) query.andWhere('reservation.tableId = :tableId', { tableId });

    if (search?.trim()) {
      query.andWhere(
        '(reservation.customerName LIKE :search OR reservation.customerPhone LIKE :search OR reservation.notes LIKE :search OR reservation.specialRequest LIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Reservation> {
    const reservation = await this.reservationRepo.findOne({ where: { id } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  async update(id: string, dto: UpdateReservationDto): Promise<Reservation> {
    const reservation = await this.findOne(id);

    if (dto.customerName !== undefined) reservation.customerName = dto.customerName.trim();
    if (dto.customerPhone !== undefined) reservation.customerPhone = dto.customerPhone?.trim() || null;
    if (dto.partySize !== undefined) reservation.partySize = dto.partySize;
    if (dto.reservationDate !== undefined) reservation.reservationDate = dto.reservationDate;
    if (dto.reservationTime !== undefined) reservation.reservationTime = dto.reservationTime;
    if (dto.notes !== undefined) reservation.notes = dto.notes?.trim() || null;
    if (dto.specialRequest !== undefined) reservation.specialRequest = dto.specialRequest?.trim() || null;
    if (dto.status !== undefined) reservation.status = dto.status;

    if (dto.tableId !== undefined) {
      await this.attachTableDetails(reservation, dto.tableId || null);
    }

    await this.ensureNoTableConflict(reservation);
    return this.reservationRepo.save(reservation);
  }

  async updateStatus(id: string, status: ReservationStatus): Promise<Reservation> {
    const reservation = await this.findOne(id);
    reservation.status = status;
    return this.reservationRepo.save(reservation);
  }

  async remove(id: string): Promise<void> {
    const reservation = await this.findOne(id);
    await this.reservationRepo.remove(reservation);
  }

  async getSummary(params: { from?: string; to?: string }) {
    const { from, to } = params;
    const query = this.reservationRepo.createQueryBuilder('reservation');
    if (from) query.andWhere('reservation.reservationDate >= :from', { from });
    if (to) query.andWhere('reservation.reservationDate <= :to', { to });

    const all = await query.getMany();

    const statusCount = Object.values(ReservationStatus).reduce((acc, status) => {
      acc[status] = all.filter((r) => r.status === status).length;
      return acc;
    }, {} as Record<ReservationStatus, number>);

    const totalGuests = all.reduce((sum, r) => sum + Number(r.partySize || 0), 0);

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = all
      .filter((r) => r.reservationDate >= today && [ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(r.status))
      .sort((a, b) => `${a.reservationDate} ${a.reservationTime}`.localeCompare(`${b.reservationDate} ${b.reservationTime}`))
      .slice(0, 10);

    return {
      summary: {
        total: all.length,
        totalGuests,
        pending: statusCount[ReservationStatus.PENDING],
        confirmed: statusCount[ReservationStatus.CONFIRMED],
        seated: statusCount[ReservationStatus.SEATED],
        completed: statusCount[ReservationStatus.COMPLETED],
        cancelled: statusCount[ReservationStatus.CANCELLED],
        noShow: statusCount[ReservationStatus.NO_SHOW],
      },
      upcoming,
    };
  }

  private async attachTableDetails(reservation: Reservation, tableId?: string | null) {
    if (!tableId) {
      reservation.tableId = null;
      reservation.tableNumber = null;
      return;
    }

    const table = await this.tableRepo.findOne({ where: { id: tableId } });
    if (!table) {
      throw new BadRequestException('Selected table does not exist');
    }

    reservation.tableId = table.id;
    reservation.tableNumber = table.tableNumber;
  }

  private async ensureNoTableConflict(reservation: Reservation) {
    if (!reservation.tableId) return;

    const activeStatuses = [
      ReservationStatus.PENDING,
      ReservationStatus.CONFIRMED,
      ReservationStatus.SEATED,
    ];

    const conflict = await this.reservationRepo.findOne({
      where: {
        tableId: reservation.tableId,
        reservationDate: reservation.reservationDate,
        reservationTime: reservation.reservationTime,
      },
    });

    if (
      conflict &&
      conflict.id !== reservation.id &&
      activeStatuses.includes(conflict.status) &&
      activeStatuses.includes(reservation.status)
    ) {
      throw new BadRequestException('This table already has a reservation at the selected date/time');
    }
  }
}
