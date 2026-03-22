import Pusher from 'pusher';

class PusherService {
  private pusher: Pusher;

  constructor() {
    this.pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true
    });
  }

  // Plugin installation notifications
  async notifyPluginInstalled(
    pluginId: string, 
    pluginSlug: string, 
    pluginName: string, 
    version: string,
    installedBy?: string
  ) {
    try {
      // Only send notify-others event - frontend will handle user differentiation
      await this.pusher.trigger('plugins', 'plugin:installed:notify-others', {
        pluginId,
        pluginSlug,
        pluginName,
        version,
        installedBy,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Pusher: Error sending plugin installed notification:', error);
    }
  }

  // Plugin update notifications
  async notifyPluginUpdated(
    pluginId: string, 
    pluginSlug: string, 
    pluginName: string, 
    oldVersion: string, 
    newVersion: string,
    updatedBy?: string
  ) {
    try {
      // Only send notify-others event - frontend will handle user differentiation
      await this.pusher.trigger('plugins', 'plugin:updated:notify-others', {
        pluginId,
        pluginSlug,
        pluginName,
        oldVersion,
        newVersion,
        updatedBy,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Pusher: Error sending plugin updated notification:', error);
    }
  }

  // Plugin uninstall notifications
  async notifyPluginUninstalled(
    pluginId: string, 
    pluginSlug: string, 
    pluginName: string, 
    version: string,
    uninstalledBy?: string
  ) {
    try {
      // Only send notify-others event - frontend will handle user differentiation
      await this.pusher.trigger('plugins', 'plugin:uninstalled:notify-others', {
        pluginId,
        pluginSlug,
        pluginName,
        version,
        uninstalledBy,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Pusher: Error sending plugin uninstalled notification:', error);
    }
  }

  // Plugin toggle notifications (enable/disable)
  async notifyPluginToggled(
    pluginId: string, 
    pluginSlug: string, 
    pluginName: string, 
    isEnabled: boolean,
    toggledBy?: string
  ) {
    try {
      await this.pusher.trigger('plugins', 'plugin:toggled', {
        pluginId,
        pluginSlug,
        pluginName,
        isEnabled,
        toggledBy,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Pusher: Error sending plugin toggled notification:', error);
    }
  }

  // Generic notification method
  async notify(channel: string, event: string, data: any) {
    try {
      await this.pusher.trigger(channel, event, {
        ...data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`❌ Pusher: Error sending notification ${channel}:${event}:`, error);
    }
  }

  // Permission update notifications
  async notifyPermissionsUpdated(data: {
    role?: string;
    resource?: string;
    pluginId?: string | null;
    type: 'single' | 'bulk' | 'reset';
    affectedRoles?: string[];
    [key: string]: any; // Allow additional properties
  }) {
    try {
      await this.pusher.trigger('permissions', 'permissions:updated', {
        ...data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Pusher: Error sending permissions updated notification:', error);
    }
  }

  // Plugin permission update notifications
  async notifyPluginPermissionUpdated(data: {
    pluginId: string;
    role?: string;
    resource?: string;
    type?: 'single' | 'bulk';
    bulk?: boolean;
    [key: string]: any; // Allow additional properties
  }) {
    try {
      await this.pusher.trigger('permissions', 'plugin-permissions:updated', {
        ...data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Pusher: Error sending plugin permissions updated notification:', error);
    }
  }

  // Global refresh notification (when modal is closed)
  async notifyGlobalRefresh(data: {
    operation: string;
    pluginName: string;
    triggeredBy?: string;
    timestamp: string;
  }) {
    try {
      await this.pusher.trigger('plugins', 'global:refresh', {
        ...data
      });
    } catch (error) {
      console.error('❌ Pusher: Error sending global refresh notification:', error);
      throw error; // Re-throw to see the error in the controller
    }
  }

  // Get pusher instance for advanced usage
  getInstance(): Pusher {
    return this.pusher;
  }
}

export const pusherService = new PusherService();
