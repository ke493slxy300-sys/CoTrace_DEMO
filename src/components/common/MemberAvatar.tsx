import { useState } from 'react';
import type { TeamMember } from '../../types';

type MemberAvatarProps = {
  member: Pick<TeamMember, 'name' | 'initials' | 'avatarUrl'>;
  className?: string;
};

/**
 * 有有效 JPG/图片地址时显示头像；缺失或加载失败时回退姓名缩写。
 */
export function MemberAvatar({ member, className = '' }: MemberAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(member.avatarUrl) && !failed;

  if (showImage && member.avatarUrl) {
    return (
      <img
        className={`member-avatar member-avatar-image ${className}`.trim()}
        src={member.avatarUrl}
        alt=""
        width={32}
        height={32}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`member-avatar ${className}`.trim()}
      aria-hidden="true"
    >
      {member.initials}
    </span>
  );
}
