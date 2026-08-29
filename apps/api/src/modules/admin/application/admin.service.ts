import { AppError } from '../../../shared/errors/app-error';
import { Types } from 'mongoose';
import { ComplaintModel } from '../../complaints/infrastructure/complaint.model';
import { EventModel } from '../../events/infrastructure/event.model';
import { LostFoundModel } from '../../lost-found/infrastructure/lost-found.model';
import { ListingModel } from '../../marketplace/infrastructure/listing.model';
import { UserModel } from '../../users/infrastructure/user.model';
import type { UserRole } from '../../users/domain/user.types';
import { userRepository } from '../../users/infrastructure/user.repository';
import { decodeCursor, encodeCursor } from '../../../shared/pagination/cursor';
import { trustServerQuery } from '../../../shared/persistence/trusted-query';

export const adminService = {
  async dashboard(input: { tenantId: string; role: UserRole }) {
    if (!['admin', 'super_admin'].includes(input.role)) {
      throw new AppError({ statusCode: 403, code: 'FORBIDDEN', message: 'Administrator access is required.' });
    }

    const tenantId = new Types.ObjectId(input.tenantId);
    const [users, listings, complaints, events, lostFound, complaintByDepartment] = await Promise.all([
      UserModel.countDocuments({ tenantId, status: 'active' }),
      ListingModel.countDocuments({ tenantId, status: 'active' }),
      ComplaintModel.countDocuments(trustServerQuery({ tenantId, status: { $in: ['pending', 'assigned', 'in_progress'] } })),
      EventModel.countDocuments({ tenantId, status: 'published' }),
      LostFoundModel.countDocuments({ tenantId, status: 'open' }),
      ComplaintModel.aggregate([
        { $match: { tenantId, status: { $in: ['pending', 'assigned', 'in_progress'] } } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      totals: { users, activeListings: listings, openComplaints: complaints, activeEvents: events, openLostFoundItems: lostFound },
      complaintByDepartment: complaintByDepartment.map((item) => ({ department: item._id, count: item.count })),
    };
  },

  async listUsers(input: {
    tenantId: string;
    role: UserRole;
    limit: number;
    cursor?: string;
    filterRole?: UserRole;
    status?: 'active' | 'suspended';
  }) {
    assertAdministrator(input.role);
    const result = await userRepository.findAdminPage({
      tenantId: input.tenantId,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeCursor(input.cursor) } : {}),
      ...(input.filterRole ? { role: input.filterRole } : {}),
      ...(input.status ? { status: input.status } : {}),
    });
    return {
      users: result.users.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        emailVerified: Boolean(user.emailVerifiedAt),
        createdAt: user.createdAt,
      })),
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
    };
  },
};

function assertAdministrator(role: UserRole) {
  if (!['admin', 'super_admin'].includes(role)) {
    throw new AppError({ statusCode: 403, code: 'FORBIDDEN', message: 'Administrator access is required.' });
  }
}
