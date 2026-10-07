import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  /** null = system (jobs). */
  actorId: string | null;
  /** `resource.verb`, e.g. assessment.override, draw.publish (see the specs' audit tables). */
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  reason?: string;
  ip?: string;
}

/**
 * Append-only audit trail (UPDATE/DELETE are blocked by a DB trigger).
 * Pass the transaction client so the audit row commits or rolls back together with the action.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.auditLog.create({ data: entry });
  }
}
