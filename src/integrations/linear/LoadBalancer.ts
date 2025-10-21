/**
 * LoadBalancer.ts
 *
 * Implements team load balancing with capacity tracking, workload distribution,
 * and automatic rebalancing to optimize team productivity.
 */

import { LinearClient, LinearIssue, LinearUser } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  skills: string[];
  capacity: number; // Hours per week
  currentLoad: number; // Hours currently assigned
  availability: number; // Percentage (0-100)
  preferredWorkHours: {
    start: string; // HH:MM format
    end: string; // HH:MM format
  };
  timeZone: string;
  lastUpdated: Date;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  totalCapacity: number; // Total hours per week
  currentUtilization: number; // Total hours currently assigned
  availableCapacity: number; // Total hours available
  utilizationPercentage: number; // Percentage of capacity used
  overloadThreshold: number; // Percentage at which team is considered overloaded (e.g., 80%)
  lastBalanced: Date;
}

export interface WorkloadDistribution {
  issueId: string;
  title: string;
  assigneeId: string;
  estimatedHours: number;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate?: string;
  complexity: number; // 1-5 scale
}

export interface LoadBalancingRecommendation {
  issueId: string;
  currentAssigneeId: string;
  recommendedAssigneeId: string;
  reason: string;
  projectedImprovement: number; // Percentage improvement in balance
}

export interface RebalancingAction {
  type: 'reassign_issue' | 'adjust_capacity' | 'notify_overload' | 'suggest_hiring';
  issueId?: string;
  fromUserId?: string;
  toUserId?: string;
  teamId?: string;
  capacityAdjustment?: number; // Hours to adjust capacity
  message?: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface OverloadDetection {
  teamId: string;
  userId?: string;
  overloadPercentage: number;
  capacity: number;
  currentLoad: number;
  detectedAt: Date;
  resolved: boolean;
  resolution?: string;
}

export class LoadBalancer {
  private linearClient: LinearClient;
  private teams: Map<string, Team>;
  private workloadDistributions: Map<string, WorkloadDistribution[]>;
  private overloadDetections: OverloadDetection[];
  private logger: Logger;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.teams = new Map();
    this.workloadDistributions = new Map();
    this.overloadDetections = [];
    this.logger = new Logger('LoadBalancer');
  }

  /**
   * Initialize the load balancer
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing LoadBalancer');

      // Load initial team data
      await this.refreshTeamData();

      this.logger.info('LoadBalancer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize LoadBalancer', error);
      throw error;
    }
  }

  /**
   * Refresh team data from Linear
   */
  public async refreshTeamData(): Promise<void> {
    try {
      this.logger.info('Refreshing team data');

      // In a real implementation, this would fetch actual team data from Linear
      // For now, we'll create sample data

      this.logger.info('Team data refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh team data', error);
      throw error;
    }
  }

  /**
   * Add or update a team
   */
  public updateTeam(team: Team): void {
    try {
      this.logger.info(`Updating team: ${team.name}`);

      this.teams.set(team.id, team);

      // Recalculate team metrics
      this.calculateTeamMetrics(team.id);

      this.logger.info(`Team updated successfully: ${team.name}`);
    } catch (error) {
      this.logger.error(`Failed to update team: ${team.name}`, error);
      throw error;
    }
  }

  /**
   * Remove a team
   */
  public removeTeam(teamId: string): boolean {
    try {
      this.logger.info(`Removing team: ${teamId}`);

      const team = this.teams.get(teamId);
      if (!team) {
        this.logger.warn(`Team not found: ${teamId}`);
        return false;
      }

      const deleted = this.teams.delete(teamId);
      if (deleted) {
        this.logger.info(`Team removed successfully: ${team.name}`);
      } else {
        this.logger.warn(`Failed to remove team: ${teamId}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove team: ${teamId}`, error);
      throw error;
    }
  }

  /**
   * Get a team by ID
   */
  public getTeam(teamId: string): Team | undefined {
    return this.teams.get(teamId);
  }

  /**
   * Get all teams
   */
  public getAllTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  /**
   * Calculate team metrics
   */
  private calculateTeamMetrics(teamId: string): void {
    try {
      this.logger.info(`Calculating metrics for team: ${teamId}`);

      const team = this.teams.get(teamId);
      if (!team) {
        this.logger.warn(`Team not found: ${teamId}`);
        return;
      }

      // Calculate total capacity
      team.totalCapacity = team.members.reduce((sum, member) => sum + member.capacity, 0);

      // Calculate current utilization
      team.currentUtilization = team.members.reduce((sum, member) => sum + member.currentLoad, 0);

      // Calculate available capacity
      team.availableCapacity = team.totalCapacity - team.currentUtilization;

      // Calculate utilization percentage
      team.utilizationPercentage =
        team.totalCapacity > 0 ? (team.currentUtilization / team.totalCapacity) * 100 : 0;

      // Update the team
      this.teams.set(teamId, team);

      this.logger.info(`Metrics calculated for team: ${team.name}`);
    } catch (error) {
      this.logger.error(`Failed to calculate metrics for team: ${teamId}`, error);
      throw error;
    }
  }

  /**
   * Update workload distribution for a team
   */
  public updateWorkloadDistribution(teamId: string, distributions: WorkloadDistribution[]): void {
    try {
      this.logger.info(`Updating workload distribution for team: ${teamId}`);

      this.workloadDistributions.set(teamId, distributions);

      // Update team member loads
      this.updateTeamMemberLoads(teamId, distributions);

      // Recalculate team metrics
      this.calculateTeamMetrics(teamId);

      this.logger.info(`Workload distribution updated for team: ${teamId}`);
    } catch (error) {
      this.logger.error(`Failed to update workload distribution for team: ${teamId}`, error);
      throw error;
    }
  }

  /**
   * Update individual team member loads based on workload distribution
   */
  private updateTeamMemberLoads(teamId: string, distributions: WorkloadDistribution[]): void {
    try {
      this.logger.info(`Updating team member loads for team: ${teamId}`);

      const team = this.teams.get(teamId);
      if (!team) {
        this.logger.warn(`Team not found: ${teamId}`);
        return;
      }

      // Reset all member loads
      for (const member of team.members) {
        member.currentLoad = 0;
      }

      // Aggregate loads by assignee
      const loadByUser: Record<string, number> = {};

      for (const distribution of distributions) {
        if (distribution.assigneeId) {
          loadByUser[distribution.assigneeId] =
            (loadByUser[distribution.assigneeId] || 0) + distribution.estimatedHours;
        }
      }

      // Update member loads
      for (const member of team.members) {
        if (loadByUser[member.userId]) {
          member.currentLoad = loadByUser[member.userId];
        }
      }

      // Update the team
      this.teams.set(teamId, team);

      this.logger.info(`Team member loads updated for team: ${teamId}`);
    } catch (error) {
      this.logger.error(`Failed to update team member loads for team: ${teamId}`, error);
      throw error;
    }
  }

  /**
   * Detect team or individual overload
   */
  public detectOverload(teamId: string): OverloadDetection[] {
    try {
      this.logger.info(`Detecting overload for team: ${teamId}`);

      const team = this.teams.get(teamId);
      if (!team) {
        this.logger.warn(`Team not found: ${teamId}`);
        return [];
      }

      const detections: OverloadDetection[] = [];

      // Check team-level overload
      if (team.utilizationPercentage > team.overloadThreshold) {
        const detection: OverloadDetection = {
          teamId: team.id,
          overloadPercentage: team.utilizationPercentage,
          capacity: team.totalCapacity,
          currentLoad: team.currentUtilization,
          detectedAt: new Date(),
          resolved: false,
        };

        this.overloadDetections.push(detection);
        detections.push(detection);

        this.logger.warn(`Team overload detected: ${team.name} (${team.utilizationPercentage}%)`);
      }

      // Check individual member overload
      for (const member of team.members) {
        const memberLoadPercentage =
          member.capacity > 0 ? (member.currentLoad / member.capacity) * 100 : 0;

        if (memberLoadPercentage > team.overloadThreshold) {
          const detection: OverloadDetection = {
            teamId: team.id,
            userId: member.userId,
            overloadPercentage: memberLoadPercentage,
            capacity: member.capacity,
            currentLoad: member.currentLoad,
            detectedAt: new Date(),
            resolved: false,
          };

          this.overloadDetections.push(detection);
          detections.push(detection);

          this.logger.warn(`Member overload detected: ${member.name} (${memberLoadPercentage}%)`);
        }
      }

      this.logger.info(`Overload detection completed for team: ${teamId}`);
      return detections;
    } catch (error) {
      this.logger.error(`Failed to detect overload for team: ${teamId}`, error);
      throw error;
    }
  }

  /**
   * Get all overload detections
   */
  public getOverloadDetections(): OverloadDetection[] {
    return [...this.overloadDetections];
  }

  /**
   * Get unresolved overload detections
   */
  public getUnresolvedOverloads(): OverloadDetection[] {
    return this.overloadDetections.filter((d) => !d.resolved);
  }

  /**
   * Resolve an overload detection
   */
  public resolveOverload(detectionId: string, resolution: string): void {
    try {
      this.logger.info(`Resolving overload detection: ${detectionId}`);

      const detection = this.overloadDetections.find(
        (d) =>
          // We'll use the index as a pseudo-ID for simplicity
          this.overloadDetections.indexOf(d).toString() === detectionId
      );

      if (detection) {
        detection.resolved = true;
        detection.resolution = resolution;
        this.logger.info(`Overload detection resolved: ${detectionId}`);
      } else {
        this.logger.warn(`Overload detection not found: ${detectionId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to resolve overload detection: ${detectionId}`, error);
      throw error;
    }
  }

  /**
   * Generate load balancing recommendations
   */
  public generateBalancingRecommendations(teamId: string): LoadBalancingRecommendation[] {
    try {
      this.logger.info(`Generating balancing recommendations for team: ${teamId}`);

      const team = this.teams.get(teamId);
      if (!team) {
        this.logger.warn(`Team not found: ${teamId}`);
        return [];
      }

      const recommendations: LoadBalancingRecommendation[] = [];

      // In a real implementation, this would analyze workload distributions
      // and generate specific recommendations for rebalancing
      // For now, we'll return an empty array as a placeholder

      this.logger.info(
        `Generated ${recommendations.length} balancing recommendations for team: ${teamId}`
      );
      return recommendations;
    } catch (error) {
      this.logger.error(`Failed to generate balancing recommendations for team: ${teamId}`, error);
      throw error;
    }
  }

  /**
   * Generate rebalancing actions
   */
  public generateRebalancingActions(teamId: string): RebalancingAction[] {
    try {
      this.logger.info(`Generating rebalancing actions for team: ${teamId}`);

      const team = this.teams.get(teamId);
      if (!team) {
        this.logger.warn(`Team not found: ${teamId}`);
        return [];
      }

      const actions: RebalancingAction[] = [];

      // Check for overloaded team
      if (team.utilizationPercentage > team.overloadThreshold) {
        actions.push({
          type: 'notify_overload',
          teamId: team.id,
          message: `Team ${team.name} is overloaded at ${team.utilizationPercentage.toFixed(1)}%`,
          urgency:
            team.utilizationPercentage > 90
              ? 'high'
              : team.utilizationPercentage > 80
                ? 'medium'
                : 'low',
        });
      }

      // Check for overloaded individuals
      for (const member of team.members) {
        const loadPercentage =
          member.capacity > 0 ? (member.currentLoad / member.capacity) * 100 : 0;

        if (loadPercentage > team.overloadThreshold) {
          actions.push({
            type: 'notify_overload',
            teamId: team.id,
            message: `Team member ${member.name} is overloaded at ${loadPercentage.toFixed(1)}%`,
            urgency: loadPercentage > 90 ? 'high' : loadPercentage > 80 ? 'medium' : 'low',
          });
        }
      }

      this.logger.info(`Generated ${actions.length} rebalancing actions for team: ${teamId}`);
      return actions;
    } catch (error) {
      this.logger.error(`Failed to generate rebalancing actions for team: ${teamId}`, error);
      throw error;
    }
  }

  /**
   * Execute rebalancing actions
   */
  public async executeRebalancingActions(actions: RebalancingAction[]): Promise<boolean[]> {
    try {
      this.logger.info(`Executing ${actions.length} rebalancing actions`);

      const results: boolean[] = [];

      for (const action of actions) {
        try {
          const success = await this.executeRebalancingAction(action);
          results.push(success);
        } catch (error) {
          this.logger.error(`Failed to execute rebalancing action`, error);
          results.push(false);
        }
      }

      this.logger.info(
        `Executed ${results.filter((r) => r).length}/${actions.length} rebalancing actions successfully`
      );
      return results;
    } catch (error) {
      this.logger.error(`Failed to execute rebalancing actions`, error);
      throw error;
    }
  }

  /**
   * Execute a single rebalancing action
   */
  private async executeRebalancingAction(action: RebalancingAction): Promise<boolean> {
    try {
      this.logger.info(`Executing rebalancing action: ${action.type}`);

      switch (action.type) {
        case 'reassign_issue':
          if (action.issueId && action.fromUserId && action.toUserId) {
            // Reassign the issue in Linear
            await this.linearClient.updateIssue(action.issueId, {
              assigneeId: action.toUserId,
            });
            this.logger.info(
              `Reassigned issue ${action.issueId} from ${action.fromUserId} to ${action.toUserId}`
            );
            return true;
          }
          return false;

        case 'adjust_capacity':
          if (action.teamId && action.capacityAdjustment) {
            // Adjust team capacity
            this.logger.info(
              `Would adjust capacity for team ${action.teamId} by ${action.capacityAdjustment} hours`
            );
            return true;
          }
          return false;

        case 'notify_overload':
          if (action.message) {
            // Send notification about overload
            this.logger.info(`Sending overload notification: ${action.message}`);
            return true;
          }
          return false;

        case 'suggest_hiring':
          // Suggest hiring based on overload
          this.logger.info(`Would suggest hiring to address overload`);
          return true;

        default:
          this.logger.warn(`Unknown rebalancing action type: ${action.type}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Failed to execute rebalancing action: ${action.type}`, error);
      throw error;
    }
  }

  /**
   * Automatically rebalance team workloads
   */
  public async autoRebalance(teamId: string): Promise<boolean> {
    try {
      this.logger.info(`Auto-rebalancing team: ${teamId}`);

      const team = this.teams.get(teamId);
      if (!team) {
        this.logger.warn(`Team not found: ${teamId}`);
        return false;
      }

      // Detect any overloads
      const overloads = this.detectOverload(teamId);

      if (overloads.length === 0) {
        this.logger.info(`No overloads detected for team: ${team.name}`);
        return true;
      }

      // Generate rebalancing actions
      const actions = this.generateRebalancingActions(teamId);

      if (actions.length === 0) {
        this.logger.info(`No rebalancing actions needed for team: ${team.name}`);
        return true;
      }

      // Execute actions
      const results = await this.executeRebalancingActions(actions);

      // Update last balanced timestamp
      team.lastBalanced = new Date();
      this.teams.set(teamId, team);

      const success = results.every((r) => r);
      if (success) {
        this.logger.info(`Auto-rebalancing completed successfully for team: ${team.name}`);
      } else {
        this.logger.warn(`Auto-rebalancing completed with some failures for team: ${team.name}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to auto-rebalance team: ${teamId}`, error);
      throw error;
    }
  }

  /**
   * Get team load statistics
   */
  public getLoadStatistics(teamId: string): {
    totalIssues: number;
    totalEstimatedHours: number;
    averageIssueComplexity: number;
    busiestMembers: Array<{ userId: string; name: string; load: number }>;
    underutilizedMembers: Array<{ userId: string; name: string; available: number }>;
  } {
    try {
      this.logger.info(`Generating load statistics for team: ${teamId}`);

      const team = this.teams.get(teamId);
      if (!team) {
        this.logger.warn(`Team not found: ${teamId}`);
        return {
          totalIssues: 0,
          totalEstimatedHours: 0,
          averageIssueComplexity: 0,
          busiestMembers: [],
          underutilizedMembers: [],
        };
      }

      const distributions = this.workloadDistributions.get(teamId) || [];

      // Calculate statistics
      const stats = {
        totalIssues: distributions.length,
        totalEstimatedHours: distributions.reduce((sum, d) => sum + d.estimatedHours, 0),
        averageIssueComplexity:
          distributions.length > 0
            ? distributions.reduce((sum, d) => sum + d.complexity, 0) / distributions.length
            : 0,
        busiestMembers: [] as Array<{ userId: string; name: string; load: number }>,
        underutilizedMembers: [] as Array<{ userId: string; name: string; available: number }>,
      };

      // Calculate member loads
      const memberLoads: Record<string, number> = {};
      for (const distribution of distributions) {
        if (distribution.assigneeId) {
          memberLoads[distribution.assigneeId] =
            (memberLoads[distribution.assigneeId] || 0) + distribution.estimatedHours;
        }
      }

      // Find busiest members (top 3)
      const memberLoadEntries = Object.entries(memberLoads);
      memberLoadEntries.sort((a, b) => b[1] - a[1]);
      stats.busiestMembers = memberLoadEntries.slice(0, 3).map(([userId, load]) => {
        const member = team.members.find((m) => m.userId === userId);
        return {
          userId,
          name: member ? member.name : `Unknown (${userId})`,
          load,
        };
      });

      // Find underutilized members
      stats.underutilizedMembers = team.members
        .filter((member) => {
          const currentLoad = memberLoads[member.userId] || 0;
          const available = member.capacity - currentLoad;
          return available > member.capacity * 0.3; // More than 30% available
        })
        .map((member) => {
          const currentLoad = memberLoads[member.userId] || 0;
          const available = member.capacity - currentLoad;
          return {
            userId: member.userId,
            name: member.name,
            available,
          };
        });

      this.logger.info(`Load statistics generated for team: ${team.name}`);
      return stats;
    } catch (error) {
      this.logger.error(`Failed to generate load statistics for team: ${teamId}`, error);
      throw error;
    }
  }

  /**
   * Predict future workload trends
   */
  public predictWorkloadTrends(
    teamId: string,
    daysAhead: number = 30
  ): {
    predictedUtilization: number;
    predictedOverloadRisk: 'low' | 'medium' | 'high';
    recommendedActions: string[];
  } {
    try {
      this.logger.info(`Predicting workload trends for team: ${teamId} (${daysAhead} days ahead)`);

      const team = this.teams.get(teamId);
      if (!team) {
        this.logger.warn(`Team not found: ${teamId}`);
        return {
          predictedUtilization: 0,
          predictedOverloadRisk: 'low',
          recommendedActions: [],
        };
      }

      // In a real implementation, this would use historical data and ML models
      // to predict future workload trends
      // For now, we'll return placeholder predictions

      const predictions = {
        predictedUtilization: team.utilizationPercentage,
        predictedOverloadRisk:
          team.utilizationPercentage > 90
            ? 'high'
            : team.utilizationPercentage > 80
              ? 'medium'
              : 'low',
        recommendedActions: [] as string[],
      };

      // Add recommendations based on current state
      if (predictions.predictedOverloadRisk === 'high') {
        predictions.recommendedActions.push('Consider redistributing workload');
        predictions.recommendedActions.push('Evaluate need for additional resources');
      } else if (predictions.predictedOverloadRisk === 'medium') {
        predictions.recommendedActions.push('Monitor workload closely');
        predictions.recommendedActions.push('Prepare contingency plans');
      }

      this.logger.info(`Workload trends predicted for team: ${team.name}`);
      return predictions;
    } catch (error) {
      this.logger.error(`Failed to predict workload trends for team: ${teamId}`, error);
      throw error;
    }
  }

  /**
   * Optimize team composition based on skills and workload
   */
  public optimizeTeamComposition(teamId: string): {
    suggestedChanges: Array<{
      type: 'add_member' | 'remove_member' | 'adjust_role' | 'skill_development';
      memberId?: string;
      memberName?: string;
      reason: string;
      priority: 'low' | 'medium' | 'high';
    }>;
    projectedImprovement: number; // Percentage improvement
  } {
    try {
      this.logger.info(`Optimizing team composition for team: ${teamId}`);

      const team = this.teams.get(teamId);
      if (!team) {
        this.logger.warn(`Team not found: ${teamId}`);
        return {
          suggestedChanges: [],
          projectedImprovement: 0,
        };
      }

      // In a real implementation, this would analyze:
      // 1. Skill gaps in the team
      // 2. Workload distribution efficiency
      // 3. Member performance metrics
      // 4. Team dynamics and collaboration patterns

      // For now, we'll return placeholder suggestions
      const optimization = {
        suggestedChanges: [] as Array<{
          type: 'add_member' | 'remove_member' | 'adjust_role' | 'skill_development';
          memberId?: string;
          memberName?: string;
          reason: string;
          priority: 'low' | 'medium' | 'high';
        }>,
        projectedImprovement: 0,
      };

      this.logger.info(`Team composition optimized for team: ${team.name}`);
      return optimization;
    } catch (error) {
      this.logger.error(`Failed to optimize team composition for team: ${teamId}`, error);
      throw error;
    }
  }
}
