import { Types, type ClientSession, type FilterQuery } from 'mongoose';

import { trustServerQuery } from '../../../shared/persistence/trusted-query';
import type {
  ComplaintDepartment,
  ComplaintImage,
  ComplaintIntelligence,
  ComplaintPriority,
  ComplaintStatus,
} from '../domain/complaint.types';
import { ComplaintModel, type ComplaintDocument, type ComplaintPersistence } from './complaint.model';

export const complaintRepository = {
  async create(input: {
    tenantId: string;
    reporterId: string;
    title: string;
    description: string;
    department: ComplaintDepartment;
    priority: ComplaintPriority;
    images: ComplaintImage[];
    intelligence: ComplaintIntelligence;
    session?: ClientSession;
  }): Promise<ComplaintDocument> {
    const complaints = await ComplaintModel.create(
      [
        {
          ...input,
          tenantId: new Types.ObjectId(input.tenantId),
          reporterId: new Types.ObjectId(input.reporterId),
          status: 'pending',
        },
      ],
      { session: input.session },
    );
    return complaints[0];
  },

  findById(tenantId: string, complaintId: string): Promise<ComplaintDocument | null> {
    return ComplaintModel.findOne({ _id: complaintId, tenantId: new Types.ObjectId(tenantId) }).exec();
  },

  async findPage(input: {
    tenantId: string;
    limit: number;
    cursor?: { createdAt: Date; id: string };
    reporterId?: string;
    assigneeId?: string;
    department?: ComplaintDepartment;
    priority?: ComplaintPriority;
    status?: ComplaintStatus;
  }): Promise<{ complaints: ComplaintDocument[]; nextCursor?: { createdAt: Date; id: string } }> {
    const filter: FilterQuery<ComplaintPersistence> = {
      tenantId: new Types.ObjectId(input.tenantId),
      ...(input.reporterId ? { reporterId: new Types.ObjectId(input.reporterId) } : {}),
      ...(input.assigneeId ? { assigneeId: new Types.ObjectId(input.assigneeId) } : {}),
      ...(input.department ? { department: input.department } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    if (input.cursor) {
      filter.$or = [
        { createdAt: { $lt: input.cursor.createdAt } },
        { createdAt: input.cursor.createdAt, _id: { $lt: new Types.ObjectId(input.cursor.id) } },
      ];
    }

    const complaints = await ComplaintModel.find(trustServerQuery(filter))
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit + 1)
      .exec();
    const hasMore = complaints.length > input.limit;
    const page = hasMore ? complaints.slice(0, input.limit) : complaints;
    const lastComplaint = page.at(-1);
    return {
      complaints: page,
      ...(hasMore && lastComplaint ? { nextCursor: { createdAt: lastComplaint.createdAt, id: lastComplaint.id } } : {}),
    };
  },

  findRecentOpenByDepartment(input: {
    tenantId: string;
    department: ComplaintDepartment;
    createdAfter: Date;
  }): Promise<ComplaintDocument[]> {
    return ComplaintModel.find(
      trustServerQuery({
        tenantId: new Types.ObjectId(input.tenantId),
        department: input.department,
        status: { $in: ['pending', 'assigned', 'in_progress'] },
        createdAt: { $gte: input.createdAfter },
      }),
    )
      .select('title description createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
  },

  assign(input: {
    tenantId: string;
    complaintId: string;
    assigneeId: string;
    assignedById: string;
    session?: ClientSession;
  }): Promise<ComplaintDocument | null> {
    return ComplaintModel.findOneAndUpdate(
      trustServerQuery({
        _id: input.complaintId,
        tenantId: new Types.ObjectId(input.tenantId),
        status: { $in: ['pending', 'assigned', 'in_progress'] },
      }),
      {
        $set: {
          assigneeId: new Types.ObjectId(input.assigneeId),
          assignedById: new Types.ObjectId(input.assignedById),
          assignedAt: new Date(),
          status: 'assigned',
        },
      },
      { new: true, session: input.session },
    ).exec();
  },

  updateStatus(input: {
    tenantId: string;
    complaintId: string;
    expectedStatus: ComplaintStatus;
    status: ComplaintStatus;
    session?: ClientSession;
  }): Promise<ComplaintDocument | null> {
    return ComplaintModel.findOneAndUpdate(
      { _id: input.complaintId, tenantId: new Types.ObjectId(input.tenantId), status: input.expectedStatus },
      { $set: { status: input.status } },
      { new: true, session: input.session },
    ).exec();
  },
};
