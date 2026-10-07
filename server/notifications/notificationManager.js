/**
 * COMMIT PROTOCOL: NOTIFICATION ENGINE
 * Manages user lifecycle notifications with unread/read tracking
 */

class NotificationManager {
  constructor() {
    // userId -> Array<Notification>
    this.userNotifications = new Map();
  }

  /**
   * Dispatches a new notification to a target user
   */
  dispatch({
    userId,
    type,
    title,
    message,
    commitmentId = null,
    metadata = {}
  }) {
    if (!userId) return null;

    if (!this.userNotifications.has(userId)) {
      this.userNotifications.set(userId, []);
    }

    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId,
      type,
      title,
      message,
      commitmentId,
      metadata,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    // Prepend (newest first)
    const list = this.userNotifications.get(userId);
    list.unshift(notification);

    // Keep at most 100 notifications per user
    if (list.length > 100) {
      list.pop();
    }

    return notification;
  }

  /**
   * Retrieves all notifications for a specific user
   */
  getForUser(userId) {
    if (!userId || !this.userNotifications.has(userId)) {
      return [];
    }
    return this.userNotifications.get(userId);
  }

  /**
   * Gets unread count
   */
  getUnreadCount(userId) {
    const list = this.getForUser(userId);
    return list.filter(n => !n.isRead).length;
  }

  /**
   * Marks a specific notification as read
   */
  markAsRead(userId, notificationId) {
    const list = this.getForUser(userId);
    const notif = list.find(n => n.id === notificationId);
    if (notif) {
      notif.isRead = true;
      return true;
    }
    return false;
  }

  /**
   * Marks all notifications as read for a user
   */
  markAllAsRead(userId) {
    const list = this.getForUser(userId);
    list.forEach(n => { n.isRead = true; });
    return list.length;
  }
}

export const notificationManager = new NotificationManager();
