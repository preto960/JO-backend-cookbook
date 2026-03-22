import { pusher } from '../config/pusher';

export interface NotificationData {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  category: 'system' | 'plugin' | 'user' | 'security';
  persistent?: boolean;
  actions?: Array<{
    label: string;
    action: string; // URL o acción
    style?: 'primary' | 'secondary' | 'danger';
  }>;
  metadata?: Record<string, any>;
}

class NotificationService {
  
  // Enviar notificación a un usuario específico
  async sendToUser(userId: string, notification: NotificationData) {
    try {
      const channelName = `user.${userId}`;
      console.log(`📡 Sending notification to channel: ${channelName}`);
      console.log(`📧 Notification details:`, {
        userId,
        title: notification.title,
        type: notification.type,
        category: notification.category,
        persistent: notification.persistent
      });
      
      await pusher.trigger(channelName, 'notification', notification);
      console.log(`✅ Notification successfully sent to user ${userId}: "${notification.title}"`);
    } catch (error) {
      console.error(`❌ Error sending notification to user ${userId}:`, error);
    }
  }

  // Enviar notificación a todos los usuarios conectados
  async sendToAll(notification: NotificationData, excludeUserId?: string) {
    try {
      console.log(`📢 Sending broadcast notification to all users:`, {
        title: notification.title,
        type: notification.type,
        category: notification.category,
        excludeUserId: excludeUserId || 'none'
      });
      
      await pusher.trigger('notifications', 'broadcast', {
        ...notification,
        excludeUserId
      });
      console.log(`✅ Broadcast notification sent successfully: "${notification.title}"`);
    } catch (error) {
      console.error('❌ Error sending broadcast notification:', error);
    }
  }

  // Enviar notificación a usuarios con rol específico
  async sendToRole(role: string, notification: NotificationData) {
    try {
      const channelName = `role.${role}`;
      console.log(`👥 Sending notification to role channel: ${channelName}`);
      console.log(`📧 Role notification details:`, {
        role,
        title: notification.title,
        type: notification.type,
        category: notification.category
      });
      
      await pusher.trigger(channelName, 'notification', notification);
      console.log(`✅ Role notification sent successfully to ${role}: "${notification.title}"`);
    } catch (error) {
      console.error(`❌ Error sending notification to role ${role}:`, error);
    }
  }

  // Métodos específicos para eventos comunes
  async notifyPluginInstalled(pluginName: string, pluginId: string, installedBy: string, allUserIds: string[]) {
    const notification: NotificationData = {
      type: 'success',
      title: 'Plugin Instalado',
      message: `${pluginName} se instaló correctamente`,
      category: 'plugin',
      persistent: true,
      metadata: {
        plugin_name: pluginName,
        plugin_id: pluginId,
        installed_by: installedBy
      }
    };

    console.log(`🔄 Sending plugin installation notifications to ${allUserIds.length} users (excluding installer: ${installedBy})`);
    
    // Enviar a todos los usuarios excepto quien lo instaló
    let notificationsSent = 0;
    for (const userId of allUserIds) {
      if (userId !== installedBy) {
        await this.sendToUser(userId, notification);
        notificationsSent++;
      }
    }

    console.log(`📊 Plugin installation notifications sent to ${notificationsSent} users`);

    // También enviar al que lo instaló como confirmación
    console.log(`📧 Sending confirmation to installer: ${installedBy}`);
    await this.sendToUser(installedBy, {
      ...notification,
      title: 'Plugin Instalado Exitosamente',
      message: `Has instalado ${pluginName} correctamente`
    });
  }

  async notifyPluginUninstalled(pluginName: string, uninstalledBy: string, allUserIds: string[]) {
    const notification: NotificationData = {
      type: 'info',
      title: 'Plugin Desinstalado',
      message: `${pluginName} ha sido desinstalado`,
      category: 'plugin',
      persistent: false,
      metadata: {
        plugin_name: pluginName,
        uninstalled_by: uninstalledBy
      }
    };

    // Enviar a todos los usuarios excepto quien lo desinstaló
    for (const userId of allUserIds) {
      if (userId !== uninstalledBy) {
        await this.sendToUser(userId, notification);
      }
    }
  }

  async notifyPluginUpdated(pluginName: string, version: string, updatedBy: string, allUserIds: string[]) {
    const notification: NotificationData = {
      type: 'success',
      title: 'Plugin Actualizado',
      message: `${pluginName} se actualizó a la versión ${version}`,
      category: 'plugin',
      persistent: true,
      metadata: {
        plugin_name: pluginName,
        version: version,
        updated_by: updatedBy
      }
    };

    // Enviar a todos los usuarios
    for (const userId of allUserIds) {
      await this.sendToUser(userId, notification);
    }
  }

  async notifyUserCreated(newUserName: string, createdBy: string, adminUserIds: string[]) {
    const notification: NotificationData = {
      type: 'info',
      title: 'Nuevo Usuario Creado',
      message: `Se creó el usuario: ${newUserName}`,
      category: 'user',
      persistent: true,
      metadata: {
        new_user: newUserName,
        created_by: createdBy
      }
    };

    console.log(`👨‍💼 Sending user creation notifications to ${adminUserIds.length} admins (excluding creator: ${createdBy})`);
    
    // Solo notificar a otros admins
    let adminNotificationsSent = 0;
    for (const adminId of adminUserIds) {
      if (adminId !== createdBy) {
        await this.sendToUser(adminId, notification);
        adminNotificationsSent++;
      }
    }
    
    console.log(`📊 User creation notifications sent to ${adminNotificationsSent} admins`);
  }

  async notifyUserUpdated(updatedUserName: string, updatedUserId: string, updatedBy: string, changes: string[]) {
    // Notificar al usuario afectado si no fue él quien se actualizó
    if (updatedUserId !== updatedBy) {
      await this.sendToUser(updatedUserId, {
        type: 'info',
        title: 'Perfil Actualizado',
        message: `Tu perfil ha sido actualizado por un administrador`,
        category: 'user',
        persistent: true,
        metadata: {
          updated_by: updatedBy,
          changes: changes
        }
      });
    }
  }

  async notifyUserDeleted(deletedUserName: string, deletedBy: string, adminUserIds: string[]) {
    const notification: NotificationData = {
      type: 'warning',
      title: 'Usuario Eliminado',
      message: `El usuario ${deletedUserName} ha sido eliminado`,
      category: 'user',
      persistent: true,
      metadata: {
        deleted_user: deletedUserName,
        deleted_by: deletedBy
      }
    };

    // Notificar a otros admins
    for (const adminId of adminUserIds) {
      if (adminId !== deletedBy) {
        await this.sendToUser(adminId, notification);
      }
    }
  }

  async notifyRoleChanged(userId: string, newRole: string, changedBy: string) {
    await this.sendToUser(userId, {
      type: 'info',
      title: 'Rol Actualizado',
      message: `Tu rol ha sido cambiado a: ${newRole}`,
      category: 'user',
      persistent: true,
      metadata: {
        new_role: newRole,
        changed_by: changedBy
      }
    });
  }

  async notifySystemMaintenance(message: string, allUserIds: string[]) {
    const notification: NotificationData = {
      type: 'warning',
      title: 'Mantenimiento Programado',
      message,
      category: 'system',
      persistent: true,
      metadata: {
        maintenance_type: 'scheduled'
      }
    };

    // Enviar a todos los usuarios
    for (const userId of allUserIds) {
      await this.sendToUser(userId, notification);
    }
  }

  async notifySystemBackup(success: boolean, message: string, adminUserIds: string[]) {
    const notification: NotificationData = {
      type: success ? 'success' : 'error',
      title: success ? 'Backup Completado' : 'Error en Backup',
      message,
      category: 'system',
      persistent: true,
      metadata: {
        backup_success: success,
        timestamp: new Date().toISOString()
      }
    };

    // Solo notificar a admins
    for (const adminId of adminUserIds) {
      await this.sendToUser(adminId, notification);
    }
  }

  async notifySecurityAlert(message: string, userId: string, alertType: string = 'general') {
    const notification: NotificationData = {
      type: 'error',
      title: 'Alerta de Seguridad',
      message,
      category: 'security',
      persistent: true,
      metadata: {
        alert_type: alertType,
        timestamp: new Date().toISOString()
      }
    };

    await this.sendToUser(userId, notification);
  }

  async notifyNewLogin(userId: string, location: string, device: string, ip: string) {
    await this.sendToUser(userId, {
      type: 'info',
      title: 'Nuevo Inicio de Sesión',
      message: `Inicio de sesión desde ${location} - ${device}`,
      category: 'security',
      persistent: true,
      metadata: {
        location,
        device,
        ip,
        timestamp: new Date().toISOString()
      }
    });
  }

  async notifyPermissionsChanged(affectedUserIds: string[], changedBy: string, resourceType: string) {
    const notification: NotificationData = {
      type: 'info',
      title: 'Permisos Actualizados',
      message: `Tus permisos han sido actualizados`,
      category: 'user',
      persistent: true,
      metadata: {
        resource_type: resourceType,
        changed_by: changedBy
      }
    };

    // Notificar a usuarios afectados
    for (const userId of affectedUserIds) {
      if (userId !== changedBy) {
        await this.sendToUser(userId, notification);
      }
    }
  }

  async notifySettingsChanged(settingType: string, changedBy: string, allUserIds: string[]) {
    const notification: NotificationData = {
      type: 'info',
      title: 'Configuración Actualizada',
      message: `La configuración del sistema ha sido actualizada`,
      category: 'system',
      persistent: false,
      metadata: {
        setting_type: settingType,
        changed_by: changedBy
      }
    };

    // Notificar a todos excepto quien hizo el cambio
    for (const userId of allUserIds) {
      if (userId !== changedBy) {
        await this.sendToUser(userId, notification);
      }
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;