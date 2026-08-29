export const noticeCategories = ['department', 'hostel', 'placements', 'academics', 'exams', 'general'] as const;
export const noticeAudiences = ['all', 'student', 'faculty', 'maintenance_staff'] as const;
export type NoticeCategory = (typeof noticeCategories)[number];
export type NoticeAudience = (typeof noticeAudiences)[number];
