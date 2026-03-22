import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { DashboardCard, CardDataType } from '../models/DashboardCard';
import { DashboardBlock, BlockType, ChartType } from '../models/DashboardBlock';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export class DashboardController {
  private cardRepository = AppDataSource.getRepository(DashboardCard);
  private blockRepository = AppDataSource.getRepository(DashboardBlock);

  // CARDS MANAGEMENT

  // Get all dashboard cards
  getAllCards = async (req: AuthRequest, res: Response) => {
    try {
      const cards = await this.cardRepository.find({
        where: { isActive: true },
        order: { order: 'ASC' }
      });

      res.json({ cards });
    } catch (error) {
      console.error('Error fetching dashboard cards:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard cards' });
    }
  };

  // Create new dashboard card
  createCard = async (req: AuthRequest, res: Response) => {
    try {
      const { title, icon, endpoint, secondaryTitle, secondaryIcon, secondaryEndpoint, secondaryDataType, dataType, columns, description, config } = req.body;

      if (!title || !icon || !endpoint) {
        throw createError('Title, icon, and endpoint are required', 400);
      }

      // Validate columns value
      const validColumns = [1.5, 3, 6];
      const numColumns = columns ? (typeof columns === 'string' ? parseFloat(columns) : columns) : 3;
      if (columns && !validColumns.includes(numColumns)) {
        throw createError('Columns must be 1.5, 3, or 6', 400);
      }

      // Get the next order number
      const maxOrder = await this.cardRepository
        .createQueryBuilder('card')
        .select('MAX(card.order)', 'max')
        .getRawOne();

      const card = this.cardRepository.create({
        title,
        icon,
        endpoint,
        secondaryTitle,
        secondaryIcon,
        secondaryEndpoint,
        secondaryDataType,
        dataType: dataType || CardDataType.NUMBER,
        columns: numColumns,
        description,
        config,
        order: (maxOrder?.max || 0) + 1
      });

      await this.cardRepository.save(card);

      res.status(201).json({
        message: 'Dashboard card created successfully',
        card
      });
    } catch (error) {
      console.error('Error creating dashboard card:', error);
      res.status(500).json({ message: 'Failed to create dashboard card' });
    }
  };

  // Update dashboard card
  updateCard = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { title, icon, endpoint, secondaryTitle, secondaryIcon, secondaryEndpoint, secondaryDataType, dataType, columns, description, config, order, isActive } = req.body;

      const card = await this.cardRepository.findOne({ where: { id } });

      if (!card) {
        throw createError('Dashboard card not found', 404);
      }

      // Validate columns value if provided
      if (columns !== undefined) {
        const numColumns = typeof columns === 'string' ? parseFloat(columns) : columns;
        const validColumns = [1.5, 3, 6];
        if (!validColumns.includes(numColumns)) {
          throw createError('Columns must be 1.5, 3, or 6', 400);
        }
      }

      // Update fields
      if (title !== undefined) card.title = title;
      if (icon !== undefined) card.icon = icon;
      if (endpoint !== undefined) card.endpoint = endpoint;
      if (secondaryTitle !== undefined) card.secondaryTitle = secondaryTitle;
      if (secondaryIcon !== undefined) card.secondaryIcon = secondaryIcon;
      if (secondaryEndpoint !== undefined) card.secondaryEndpoint = secondaryEndpoint;
      if (secondaryDataType !== undefined) card.secondaryDataType = secondaryDataType;
      if (dataType !== undefined) card.dataType = dataType;
      if (columns !== undefined) {
        const numColumns = typeof columns === 'string' ? parseFloat(columns) : columns;
        card.columns = numColumns;
      }
      if (description !== undefined) card.description = description;
      if (config !== undefined) card.config = config;
      if (order !== undefined) card.order = order;
      if (isActive !== undefined) card.isActive = isActive;

      await this.cardRepository.save(card);

      res.json({
        message: 'Dashboard card updated successfully',
        card
      });
    } catch (error) {
      console.error('Error updating dashboard card:', error);
      res.status(500).json({ message: 'Failed to update dashboard card' });
    }
  };

  // Delete dashboard card
  deleteCard = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const card = await this.cardRepository.findOne({ where: { id } });

      if (!card) {
        throw createError('Dashboard card not found', 404);
      }

      await this.cardRepository.remove(card);

      res.json({ message: 'Dashboard card deleted successfully' });
    } catch (error) {
      console.error('Error deleting dashboard card:', error);
      res.status(500).json({ message: 'Failed to delete dashboard card' });
    }
  };

  // Reorder dashboard cards
  reorderCards = async (req: AuthRequest, res: Response) => {
    try {
      const { cardIds } = req.body; // Array of card IDs in new order

      if (!Array.isArray(cardIds)) {
        throw createError('cardIds must be an array', 400);
      }

      // Update order for each card
      for (let i = 0; i < cardIds.length; i++) {
        await this.cardRepository.update(cardIds[i], { order: i });
      }

      res.json({ message: 'Dashboard cards reordered successfully' });
    } catch (error) {
      console.error('Error reordering dashboard cards:', error);
      res.status(500).json({ message: 'Failed to reorder dashboard cards' });
    }
  };

  // BLOCKS MANAGEMENT

  // Get all dashboard blocks
  getAllBlocks = async (req: AuthRequest, res: Response) => {
    try {
      const blocks = await this.blockRepository.find({
        where: { isActive: true },
        order: { order: 'ASC' }
      });

      res.json({ blocks });
    } catch (error) {
      console.error('Error fetching dashboard blocks:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard blocks' });
    }
  };

  // Create new dashboard block
  createBlock = async (req: AuthRequest, res: Response) => {
    try {
      const { title, type, chartType, endpoint, columns, description, config } = req.body;

      if (!title || !type || !endpoint) {
        throw createError('Title, type, and endpoint are required', 400);
      }

      if (type === BlockType.CHART && !chartType) {
        throw createError('Chart type is required for chart blocks', 400);
      }

      // Get the next order number
      const maxOrder = await this.blockRepository
        .createQueryBuilder('block')
        .select('MAX(block.order)', 'max')
        .getRawOne();

      const block = this.blockRepository.create({
        title,
        type,
        chartType: type === BlockType.CHART ? chartType : null,
        endpoint,
        columns: columns || 12,
        description,
        config,
        order: (maxOrder?.max || 0) + 1
      });

      await this.blockRepository.save(block);

      res.status(201).json({
        message: 'Dashboard block created successfully',
        block
      });
    } catch (error) {
      console.error('Error creating dashboard block:', error);
      res.status(500).json({ message: 'Failed to create dashboard block' });
    }
  };

  // Update dashboard block
  updateBlock = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { title, type, chartType, endpoint, columns, description, config, order, isActive } = req.body;

      const block = await this.blockRepository.findOne({ where: { id } });

      if (!block) {
        throw createError('Dashboard block not found', 404);
      }

      // Update fields
      if (title !== undefined) block.title = title;
      if (type !== undefined) block.type = type;
      if (chartType !== undefined) block.chartType = chartType;
      if (endpoint !== undefined) block.endpoint = endpoint;
      if (columns !== undefined) block.columns = columns;
      if (description !== undefined) block.description = description;
      if (config !== undefined) block.config = config;
      if (order !== undefined) block.order = order;
      if (isActive !== undefined) block.isActive = isActive;

      await this.blockRepository.save(block);

      res.json({
        message: 'Dashboard block updated successfully',
        block
      });
    } catch (error) {
      console.error('Error updating dashboard block:', error);
      res.status(500).json({ message: 'Failed to update dashboard block' });
    }
  };

  // Delete dashboard block
  deleteBlock = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const block = await this.blockRepository.findOne({ where: { id } });

      if (!block) {
        throw createError('Dashboard block not found', 404);
      }

      await this.blockRepository.remove(block);

      res.json({ message: 'Dashboard block deleted successfully' });
    } catch (error) {
      console.error('Error deleting dashboard block:', error);
      res.status(500).json({ message: 'Failed to delete dashboard block' });
    }
  };

  // Reorder dashboard blocks
  reorderBlocks = async (req: AuthRequest, res: Response) => {
    try {
      const { blockIds } = req.body; // Array of block IDs in new order

      if (!Array.isArray(blockIds)) {
        throw createError('blockIds must be an array', 400);
      }

      // Update order for each block
      for (let i = 0; i < blockIds.length; i++) {
        await this.blockRepository.update(blockIds[i], { order: i });
      }

      res.json({ message: 'Dashboard blocks reordered successfully' });
    } catch (error) {
      console.error('Error reordering dashboard blocks:', error);
      res.status(500).json({ message: 'Failed to reorder dashboard blocks' });
    }
  };

  // Get dashboard configuration (cards + blocks)
  getDashboardConfig = async (req: AuthRequest, res: Response) => {
    try {
      const [cards, blocks] = await Promise.all([
        this.cardRepository.find({
          where: { isActive: true },
          order: { order: 'ASC' }
        }),
        this.blockRepository.find({
          where: { isActive: true },
          order: { order: 'ASC' }
        })
      ]);

      res.json({ cards, blocks });
    } catch (error) {
      console.error('Error fetching dashboard configuration:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard configuration' });
    }
  };
}





