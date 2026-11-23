import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { TasmacVerificationLog } from './entities/tasmac-verification-log.entity';

export type VerificationResult = 'VERIFIED' | 'INVALID' | 'UNVERIFIED' | 'PENDING';

@Injectable()
export class TasmacVerificationService {
  private readonly logger = new Logger(TasmacVerificationService.name);
  private readonly lastScan = new Map<string, number>();

  constructor(private config: ConfigService, @InjectRepository(TasmacVerificationLog) private logs: Repository<TasmacVerificationLog>) {}

  async verify(qrIdentifier: string, user: any) {
    const code = String(qrIdentifier || '').trim();
    if (!code) throw new BadRequestException('QR identifier is required');

    const duplicateKey = `${user?.id || user?.username || 'unknown'}:${code}`;
    const now = Date.now();
    const previous = this.lastScan.get(duplicateKey) || 0;
    if (now - previous < 3000) throw new BadRequestException('Duplicate scan rejected. Wait briefly before scanning again.');
    this.lastScan.set(duplicateKey, now);

    const baseUrl = this.config.get<string>('TASMAC_API_BASE_URL')?.trim();
    const verifyPath = this.config.get<string>('TASMAC_VERIFY_PATH')?.trim();
    const apiKey = this.config.get<string>('TASMAC_API_KEY')?.trim();
    if (!baseUrl || !verifyPath || !apiKey) {
      return this.saveAndReturn(code, 'PENDING', null, user, 'Official TASMAC API configuration and credentials are pending');
    }

    try {
      const timeout = Number(this.config.get('TASMAC_API_TIMEOUT_MS', 10000));
      const authHeader = this.config.get<string>('TASMAC_API_AUTH_HEADER', 'Authorization');
      const authScheme = this.config.get<string>('TASMAC_API_AUTH_SCHEME', 'Bearer');
      const response = await axios.post(`${baseUrl.replace(/\/$/, '')}/${verifyPath.replace(/^\//, '')}`, { qrData: code }, {
        timeout,
        headers: { [authHeader]: `${authScheme} ${apiKey}`.trim(), 'Content-Type': 'application/json' },
        validateStatus: () => true,
      });

      const statusField = this.config.get<string>('TASMAC_STATUS_FIELD', 'status');
      const statusValue = this.getPath(response.data, statusField);
      const normalized = String(statusValue || '').trim().toUpperCase();
      const result: VerificationResult = normalized === 'VERIFIED' ? 'VERIFIED' : normalized === 'INVALID' ? 'INVALID' : 'UNVERIFIED';
      const reference = response.data?.referenceId || response.data?.requestId || response.headers?.['x-request-id'] || null;
      const summary = JSON.stringify({ httpStatus: response.status, result });
      return this.saveAndReturn(code, result, reference, user, summary);
    } catch (error: any) {
      this.logger.error(`TASMAC verification failed: ${error?.message || error}`);
      const message = error?.code === 'ECONNABORTED' ? 'API request timed out' : 'Unable to reach TASMAC verification API';
      await this.saveAndReturn(code, 'UNVERIFIED', null, user, JSON.stringify({ error: message }));
      throw new ServiceUnavailableException({ status: 'UNVERIFIED', message });
    }
  }

  private getPath(payload: any, path: string) {
    return String(path || '').split('.').filter(Boolean).reduce((value, key) => value?.[key], payload);
  }

  async requireVerified(code: string, user: any) {
    const requireVerified = String(this.config.get('TASMAC_REQUIRE_VERIFIED_IN_OUT', 'true')).toLowerCase() !== 'false';
    if (!requireVerified) return;
    const performedBy = user?.name || user?.username || user?.id || 'UNKNOWN';
    const recent = await this.logs.findOne({ where: { scannedIdentifier: code, result: 'VERIFIED', performedBy }, order: { verifiedAt: 'DESC' } });
    if (!recent || Date.now() - recent.verifiedAt.getTime() > 5 * 60 * 1000) {
      throw new BadRequestException('Bottle operation blocked: a recent VERIFIED TASMAC result is required');
    }
  }

  private async saveAndReturn(scannedIdentifier: string, status: VerificationResult, apiReference: string | null, user: any, responseSummary: string) {
    await this.logs.save(this.logs.create({ scannedIdentifier, result: status, apiReference: apiReference || undefined, performedBy: user?.name || user?.username || user?.id || 'UNKNOWN', responseSummary }));
    return { status, scannedIdentifier, apiReference, verifiedAt: new Date().toISOString(), bottleDetails: null };
  }
}
