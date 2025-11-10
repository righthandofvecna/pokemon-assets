/**
 * Perk List System - Efficient alternative to the perk web visualization
 * 
 * This module provides a list-based view of perks categorized by availability:
 * - Purchased: Perks the actor already owns
 * - Available Now: Perks that can be purchased (connected, AP available, prerequisites met)
 * - Available Later: Perks with prerequisites met but missing direct connections
 * - Locked: Everything else
 */

import { Predicate } from './predicate.mjs';

export const PerkState = {
    unavailable: 0,
    connected: 1,
    available: 2,
    purchased: 3,
    invalid: 4,
    autoUnlocked: 5
};

/**
 * Min-heap implementation for efficient priority queue in Dijkstra's algorithm
 */
class MinHeap {
    constructor() {
        this.heap = [];
    }

    push(item) {
        this.heap.push(item);
        this._bubbleUp(this.heap.length - 1);
    }

    pop() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();

        const min = this.heap[0];
        this.heap[0] = this.heap.pop();
        this._bubbleDown(0);
        return min;
    }

    get length() {
        return this.heap.length;
    }

    _bubbleUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[index].cost >= this.heap[parentIndex].cost) break;
            
            [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
            index = parentIndex;
        }
    }

    _bubbleDown(index) {
        while (true) {
            let minIndex = index;
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;

            if (leftChild < this.heap.length && this.heap[leftChild].cost < this.heap[minIndex].cost) {
                minIndex = leftChild;
            }
            if (rightChild < this.heap.length && this.heap[rightChild].cost < this.heap[minIndex].cost) {
                minIndex = rightChild;
            }

            if (minIndex === index) break;

            [this.heap[index], this.heap[minIndex]] = [this.heap[minIndex], this.heap[index]];
            index = minIndex;
        }
    }
}

/**
 * Main class for managing perk lists
 */
export class PerkListManager {
    constructor({ perks = [], actor = null, web = 'combined' } = {}) {
        this.perks = perks;
        this.actor = actor;
        this.web = web;
        
        // Categorized perk lists
        this.purchased = [];
        this.availableNow = [];
        this.availableLater = [];
        this.locked = [];
        
        // Internal state tracking
        this._perkMap = new Map(); // slug -> perk data
        this._connectionMap = new Map(); // slug -> Set of connected slugs
        this._purchasedSlugs = new Set();
        this._reachableSlugs = new Set(); // Reachable from purchased perks
        this._seenUuids = new Set(); // Track UUIDs to avoid duplicates
        this._seenPositions = new Set(); // Track positions (x:y) for global perks to avoid duplicates
        this._initialized = false;
        
        // Optimization caches (#7)
        this._prerequisiteCache = new Map(); // slug -> boolean (can meet prerequisites)
        this._unsatisfiablePrereqs = new Set(); // slugs with prerequisites that can never be met (#13)
    }

    /**
     * Initialize and categorize all perks
     */
    async initialize() {
        if (this._initialized) return;
        
        // Step 1: Build perk map and connection graph
        this._buildPerkMap();
        
        // Step 2: Identify purchased perks
        this._identifyPurchasedPerks();
        
        // Step 2.5: Cache prerequisite results for all perks (#7)
        this._cachePrerequisites();
        
        // Step 3: Calculate reachable perks (breadth-first from purchased)
        this._calculateReachability();
        
        // Step 4: Calculate paths to unreachable perks
        this._calculateAllPaths();
        
        // Step 5: Categorize all perks
        this._categorizePerks();
        
        this._initialized = true;
    }

    /**
     * Build internal maps for fast lookup
     */
    _buildPerkMap() {
        // Process perks in reverse order to match perk-web behavior
        // (perk-web uses Map.set which makes the last perk win, we skip duplicates so first wins)
        const reversedPerks = [...this.perks].reverse();
        
        for (const perk of reversedPerks) {
            // Filter by web if needed
            if (!this._isInCurrentWeb(perk)) continue;
            
            // Check if this is a global perk or species-specific
            const isGlobalPerk = perk.system?.global === true;
            const isEvolutionPerk = perk.flags?.ptr2e?.evolution;
            
            // Skip if we've already seen this UUID (avoid duplicates)
            // But allow evolution perks even if they have the same UUID as another evolution perk
            if (!isEvolutionPerk) {
                if (this._seenUuids.has(perk.uuid)) continue;
                this._seenUuids.add(perk.uuid);
            }
            
            // Handle multi-variant perks (perks with multiple nodes)
            if (perk.system?.variant === 'multi') {
                for (let i = 0; i < perk.system.nodes.length; i++) {
                    const node = perk.system.nodes[i];
                    if (!node.x || !node.y) continue;
                    
                    // For global perks, check if we've already seen this position
                    const positionKey = `${node.x}:${node.y}`;
                    if (isGlobalPerk && !isEvolutionPerk) {
                        if (this._seenPositions.has(positionKey)) continue;
                        this._seenPositions.add(positionKey);
                    }
                    
                    const slug = i > 0 ? `${perk.slug}-${i}` : perk.slug;
                    this._perkMap.set(slug, {
                        perk,
                        node,
                        slug,
                        nodeIndex: i,
                        isMulti: true
                    });
                    
                    // Build connection map
                    const connections = new Set(node.connected || []);
                    this._connectionMap.set(slug, connections);
                }
            } else {
                // Standard single-node perk
                const primaryNode = perk.system?.primaryNode || perk.system?.nodes?.[0];
                if (!primaryNode || !primaryNode.x || !primaryNode.y) continue;
                
                // For global perks, check if we've already seen this position
                const positionKey = `${primaryNode.x}:${primaryNode.y}`;
                if (isGlobalPerk && !isEvolutionPerk) {
                    if (this._seenPositions.has(positionKey)) continue;
                    this._seenPositions.add(positionKey);
                }
                
                this._perkMap.set(perk.slug, {
                    perk,
                    node: primaryNode,
                    slug: perk.slug,
                    nodeIndex: 0,
                    isMulti: false
                });
                
                // Build connection map
                const connections = new Set(primaryNode.connected || []);
                this._connectionMap.set(perk.slug, connections);
            }
        }
    }

    /**
     * Check if perk belongs to current web
     */
    _isInCurrentWeb(perk) {
        // In combined mode, show global perks, species-specific perks, and evolution perks
        if (this.web === 'combined') {
            // Check if it's a global perk
            if (perk.system?.global === true) {
                return true;
            }
            
            // Check if it's an evolution perk (added via species)
            if (perk.flags?.ptr2e?.evolution) {
                return true;
            }
            
            // Check if it's assigned to any species web (has any webs)
            const webs = perk.system?.webs;
            if (webs instanceof Set && webs.size > 0) {
                return true;
            }
            
            return false;
        }
        
        // Legacy support for global-only mode
        if (this.web === 'global') {
            return perk.system?.global === true;
        }
        
        // Legacy support for species-specific web mode
        if (perk.flags?.ptr2e?.evolution) {
            return true; // Evolution perks are always shown in species webs
        }
        
        // Check if the perk is explicitly assigned to this web
        const webs = perk.system?.webs;
        if (webs instanceof Set) {
            return webs.has(this.web);
        }
        
        return false;
    }

    /**
     * Identify which perks are already purchased
     */
    _identifyPurchasedPerks() {
        if (!this.actor) return;
        
        for (const [slug, data] of this._perkMap.entries()) {
            const { perk, isMulti, node } = data;
            
            // Check for evolution perks
            if (perk.flags?.ptr2e?.evolution) {
                if (this._isEvolutionPurchased(perk)) {
                    this._purchasedSlugs.add(slug);
                    continue;
                }
            }
            
            // Check if actor owns this perk
            const actorPerk = this._getActorPerk(perk, slug, isMulti);
            if (actorPerk) {
                this._purchasedSlugs.add(slug);
                
                // For tiered perks, track tier info
                if (perk.system?.variant === 'tiered') {
                    data.tierInfo = this._calculateTierInfo(perk, actorPerk);
                }
            }
        }
    }

    /**
     * Check if an evolution perk is purchased (actor has evolved to this species)
     */
    _isEvolutionPurchased(perk) {
        if (!this.actor) return false;
        
        const evolution = perk.flags.ptr2e.evolution;
        const species = this.actor.items?.get?.('actorspeciesitem');
        if (!species) return false;
        
        const sourceId = species.flags?.core?.sourceId || species._stats?.compendiumSource;
        const speciesSlug = species.slug + (species.system?.form ? `-${species.system.form}` : '');
        
        return sourceId === evolution.uuid || 
               speciesSlug === evolution.name || 
               species.slug === evolution.name;
    }

    /**
     * Get actor's perk by slug
     */
    _getActorPerk(perk, slug, isMulti) {
        if (!this.actor?.perks) return null;
        
        if (isMulti && perk.system?.mode === 'shared') {
            return this.actor.perks.get(perk.slug);
        }
        return this.actor.perks.get(slug);
    }

    /**
     * Calculate tier information for tiered perks
     */
    _calculateTierInfo(perk, actorPerk) {
        const tiers = [{ perk, tier: 1 }];
        
        // Collect all tiers
        for (const node of perk.system.nodes) {
            if (!node.tier) continue;
            
            const tierPerk = fromUuidSync(node.tier.uuid);
            if (tierPerk?.type === 'perk') {
                tiers.push({ perk: tierPerk, tier: node.tier.rank });
            }
        }
        
        const maxTier = Math.max(...tiers.map(t => t.tier));
        const lastPurchasedTier = tiers.reduce((acc, { perk: p, tier }) => {
            const item = this.actor.perks.get(p.slug);
            return item ? Math.max(acc, tier) : acc;
        }, 1);
        
        const nextTier = tiers.find(t => t.tier === lastPurchasedTier + 1);
        const previousTier = tiers.find(t => t.tier === lastPurchasedTier - 1);
        
        return {
            tier: nextTier ? nextTier.tier : lastPurchasedTier,
            perk: nextTier ? nextTier.perk : perk,
            maxTier,
            maxTierPurchased: lastPurchasedTier === maxTier,
            lastTier: actorPerk,
            previousTier: previousTier?.perk || null
        };
    }

    /**
     * Cache prerequisite evaluation results for all perks (#7)
     * This prevents redundant expensive predicate evaluations during pathfinding
     */
    _cachePrerequisites() {
        if (!this.actor) {
            // No actor, all prerequisites are considered "met"
            for (const slug of this._perkMap.keys()) {
                this._prerequisiteCache.set(slug, true);
            }
            return;
        }

        for (const [slug, data] of this._perkMap.entries()) {
            const { perk, tierInfo } = data;
            
            // Skip if already purchased
            if (this._purchasedSlugs.has(slug)) {
                this._prerequisiteCache.set(slug, true);
                continue;
            }

            const canMeet = this._evaluatePrerequisites(perk, tierInfo);
            this._prerequisiteCache.set(slug, canMeet);
            
            // Track unsatisfiable prerequisites (#13)
            if (!canMeet) {
                this._unsatisfiablePrereqs.add(slug);
            }
        }
    }

    /**
     * Internal method to evaluate prerequisites (used for caching)
     */
    _evaluatePrerequisites(perk, tierInfo) {
        const prerequisites = tierInfo?.perk.system?.prerequisites || perk.system?.prerequisites;
        if (!prerequisites || prerequisites.length === 0) return true;
        
        try {
            // Resolve prerequisites using the game's SummonStatistic resolver
            const targetPerk = tierInfo?.perk || perk;
            let resolvedPredicate = game.ptr.SummonStatistic?.resolveValue?.(
                prerequisites,
                prerequisites,
                { actor: this.actor, item: targetPerk },
                { evaluate: true, resolvables: { actor: this.actor, item: targetPerk } }
            );
            
            // If resolveValue returns undefined, use the raw prerequisites
            if (!resolvedPredicate) {
                resolvedPredicate = prerequisites;
            }
            
            // Create a Predicate and test it against actor's roll options
            const predicate = new Predicate(resolvedPredicate);
            const met = predicate.test(this.actor.getRollOptions());
            
            // If prerequisites are already met, return true
            if (met) return true;
            
            // Check if prerequisites can be met with available skill points
            return this._canMeetPrerequisitesWithSkillPoints(predicate, perk.name);
        } catch (e) {
            console.warn(`Error evaluating prerequisites for ${perk.name}:`, e);
            return true;
        }
    }

    /**
     * Calculate which perks are reachable from purchased perks (BFS)
     */
    _calculateReachability() {
        const queue = [];
        const visited = new Set();
        
        // Start with all purchased perks and root nodes
        for (const [slug, data] of this._perkMap.entries()) {
            if (this._purchasedSlugs.has(slug)) {
                queue.push(slug);
                this._reachableSlugs.add(slug);
            } else if (data.node.type === 'root') {
                // Roots are always considered "reachable" as starting points
                this._reachableSlugs.add(slug);
            }
        }
        
        // BFS to find all connected perks
        while (queue.length > 0) {
            const currentSlug = queue.shift();
            if (visited.has(currentSlug)) continue;
            visited.add(currentSlug);
            
            const connections = this._connectionMap.get(currentSlug);
            if (!connections) continue;
            
            for (const connectedSlug of connections) {
                if (!visited.has(connectedSlug)) {
                    this._reachableSlugs.add(connectedSlug);
                    
                    // If the connected perk is also purchased, traverse its connections
                    if (this._purchasedSlugs.has(connectedSlug)) {
                        queue.push(connectedSlug);
                    }
                }
            }
        }
        
        // Build reverse connection map once for use in pathfinding (#1)
        this._reverseConnectionMap = new Map();
        for (const [fromSlug, toSlugs] of this._connectionMap.entries()) {
            for (const toSlug of toSlugs) {
                if (!this._reverseConnectionMap.has(toSlug)) {
                    this._reverseConnectionMap.set(toSlug, new Set());
                }
                this._reverseConnectionMap.get(toSlug).add(fromSlug);
            }
        }
        
        // Cache root information (#2, #11 - use direct Set iteration)
        this._hasAnyPurchasedRoot = false;
        for (const slug of this._purchasedSlugs) {
            const data = this._perkMap.get(slug);
            if (data?.node.type === 'root') {
                this._hasAnyPurchasedRoot = true;
                break;
            }
        }
        
        // Build lookup sets for faster path finding (#4)
        this._rootSlugs = new Set();
        this._unpurchasedRootSlugs = new Set();
        for (const [slug, data] of this._perkMap.entries()) {
            if (data.node.type === 'root') {
                this._rootSlugs.add(slug);
                if (!this._purchasedSlugs.has(slug)) {
                    this._unpurchasedRootSlugs.add(slug);
                }
            }
        }
    }

    /**
     * Calculate shortest paths from all nodes to all unreachable perks
     * This is more efficient than running pathfinding for each perk individually
     * Uses Dijkstra's algorithm running backward from each target
     */
    _calculateAllPaths() {
        this._pathCache = new Map(); // targetSlug -> { totalCost, perks: [] }
        
        // For each unreachable perk, calculate the cheapest path to it
        for (const [slug, data] of this._perkMap.entries()) {
            if (this._purchasedSlugs.has(slug)) continue; // Already purchased
            if (this._reachableSlugs.has(slug)) continue; // Already reachable
            if (this._unsatisfiablePrereqs.has(slug)) continue; // Can never be reached (#13)
            
            const path = this._findCheapestPath(slug);
            // Cache if there are perks to purchase (even if cost is 0, like first root)
            if (path.perks.length > 0) {
                this._pathCache.set(slug, path);
            }
        }
    }

    /**
     * Find the cheapest path from any purchased perk or root to a target perk
     * Uses Dijkstra's algorithm with min-heap priority queue (#9)
     * @param {string} targetSlug - The slug of the target perk
     * @returns {Object} - { path: Array of slugs, totalCost: number, perks: Array of perk data }
     */
    _findCheapestPath(targetSlug) {
        // Use cached reverse connection map (#1)
        const reverseConnections = this._reverseConnectionMap;
        
        // Run Dijkstra BACKWARDS from the target
        // This finds the shortest path FROM any starting point TO the target
        const distances = new Map(); // slug -> minimum cost to reach target from this slug
        const previousNode = new Map(); // slug -> previous slug in optimal path
        const queue = new MinHeap(); // Use min-heap instead of array (#9)
        
        // Start from the target with cost 0
        distances.set(targetSlug, 0);
        queue.push({ slug: targetSlug, cost: 0 });
        
        // Use cached root information (#2)
        const hasAnyPurchasedRoot = this._hasAnyPurchasedRoot;
        
        const visited = new Set();
        
        while (queue.length > 0) {
            // Min-heap gives us the lowest cost automatically (#9)
            const current = queue.pop();
            
            if (visited.has(current.slug)) continue;
            visited.add(current.slug);
            
            // Get all nodes that connect TO the current node (reverse direction)
            const sources = reverseConnections.get(current.slug) || new Set();
            
            for (const sourceSlug of sources) {
                if (visited.has(sourceSlug)) continue;
                
                const sourceData = this._perkMap.get(sourceSlug);
                if (!sourceData) continue;
                
                // Skip perks whose prerequisites we can't meet (use cache) (#7)
                const isSourcePurchased = this._purchasedSlugs.has(sourceSlug);
                if (!isSourcePurchased && !this._prerequisiteCache.get(sourceSlug)) {
                    continue; // Can't use this perk in a path since we can't meet its prerequisites
                }
                
                // Cost to reach the target from this source node
                let costFromSource;
                
                if (isSourcePurchased) {
                    // Already purchased, no cost to start from here
                    costFromSource = current.cost;
                } else {
                    // Need to purchase this node
                    const sourceCost = this._getPerkCost(
                        sourceData.perk,
                        sourceData.node,
                        sourceData.tierInfo
                    );
                    costFromSource = current.cost + sourceCost;
                }
                
                // Update if this is a better path
                if (!distances.has(sourceSlug) || costFromSource < distances.get(sourceSlug)) {
                    distances.set(sourceSlug, costFromSource);
                    previousNode.set(sourceSlug, current.slug);
                    queue.push({ slug: sourceSlug, cost: costFromSource });
                }
            }
        }
        
        // Also consider unpurchased roots as starting points
        // Add them with their specific costs
        // Use cached unpurchased root set (#4)
        for (const slug of this._unpurchasedRootSlugs) {
            if (slug === targetSlug) continue;
            
            const data = this._perkMap.get(slug);
            if (!data) continue;
            
            // Calculate the cost of this root
            let rootCost = 0;
            if (hasAnyPurchasedRoot) {
                const connections = this._connectionMap.get(slug) || new Set();
                // Use Set iteration directly (#11)
                let isConnectedToPurchased = false;
                for (const connSlug of connections) {
                    if (this._purchasedSlugs.has(connSlug)) {
                        isConnectedToPurchased = true;
                        break;
                    }
                }
                rootCost = isConnectedToPurchased ? 1 : 5;
            }
            
            // If this root connects to the target (or nodes on the path to target)
            // calculate the total cost from this root
            const rootConnections = this._connectionMap.get(slug) || new Set();
            
            for (const connectedSlug of rootConnections) {
                // Check if this connects to the target directly or to a node with a path to target
                if (connectedSlug === targetSlug || distances.has(connectedSlug)) {
                    const connectedCost = connectedSlug === targetSlug ? 0 : distances.get(connectedSlug);
                    const totalCost = rootCost + connectedCost;
                    
                    // Update if this root provides a better path
                    if (!distances.has(slug) || totalCost < distances.get(slug)) {
                        distances.set(slug, totalCost);
                        previousNode.set(slug, connectedSlug);
                    }
                }
            }
        }
        
        // Find the best starting point (purchased perk or root)
        let bestStart = null;
        let bestCost = Infinity;
        
        // Check purchased perks
        for (const purchasedSlug of this._purchasedSlugs) {
            if (distances.has(purchasedSlug)) {
                const cost = distances.get(purchasedSlug);
                if (cost < bestCost) {
                    bestCost = cost;
                    bestStart = purchasedSlug;
                }
            }
        }
        
        // Check unpurchased roots (#4)
        for (const slug of this._unpurchasedRootSlugs) {
            if (distances.has(slug)) {
                const cost = distances.get(slug);
                if (cost < bestCost) {
                    bestCost = cost;
                    bestStart = slug;
                }
            }
        }
        
        // No path found
        if (bestStart === null) {
            return { path: [], totalCost: 0, perks: [] };
        }
        
        // Reconstruct the path from start to target
        const path = [];
        let currentSlug = bestStart;
        
        while (currentSlug !== targetSlug) {
            // Only add to path if it needs to be purchased
            if (!this._purchasedSlugs.has(currentSlug)) {
                path.push(currentSlug);
            }
            
            const next = previousNode.get(currentSlug);
            if (!next) break;
            currentSlug = next;
        }
        
        // Add the target to the path
        path.push(targetSlug);
        
        // Build perks array (excluding the target)
        const perks = path.slice(0, -1)
            .map(slug => this._perkMap.get(slug))
            .filter(data => data);
        
        return {
            path,
            totalCost: bestCost,
            perks
        };
    }

    /**
     * Categorize perks into purchased, available now, available later, and locked
     */
    _categorizePerks() {
        const apAvailable = this.actor?.system?.advancement?.advancementPoints?.available || 0;
        
        for (const [slug, data] of this._perkMap.entries()) {
            const { perk, node, tierInfo } = data;
            
            // Already purchased
            if (this._purchasedSlugs.has(slug)) {
                this.purchased.push(this._createPerkEntry(data, PerkState.purchased));
                continue;
            }
            
            // Check if auto-unlocked
            if (this._isAutoUnlocked(perk)) {
                this.purchased.push(this._createPerkEntry(data, PerkState.autoUnlocked));
                continue;
            }
            
            const cost = this._getPerkCost(perk, node, tierInfo);
            const hasAP = apAvailable >= cost;
            const meetsPrerequisites = this._meetsPrerequisites(perk, tierInfo);
            const isReachable = this._reachableSlugs.has(slug);

            // Available Now: reachable, has AP, meets prerequisites
            if (isReachable && hasAP && meetsPrerequisites) {
                this.availableNow.push(this._createPerkEntry(data, PerkState.available));
            }
            // Available Now (but can't afford): reachable, meets prerequisites, but not enough AP
            else if (isReachable && meetsPrerequisites) {
                this.availableNow.push(this._createPerkEntry(data, PerkState.connected));
            }
            // Available Later: not reachable but meets prerequisites AND has a valid path
            else if (meetsPrerequisites) {
                const entry = this._createPerkEntry(data, PerkState.connected);
                
                // Get the pre-calculated path from cache
                const pathInfo = this._pathCache?.get(slug) || { path: [], totalCost: 0, perks: [] };
                
                // Only put in Available Later if there's actually a path
                if (pathInfo.perks.length > 0) {
                    entry.pathToReach = pathInfo.perks;
                    entry.totalCostToReach = pathInfo.totalCost + entry.cost;
                    // Use totalCostToReach as the display cost for sorting and display
                    entry.displayCost = entry.totalCostToReach;
                    
                    this.availableLater.push(entry);
                } else {
                    // No valid path exists (intermediate perks have unmet prerequisites)
                    this.locked.push(this._createPerkEntry(data, PerkState.unavailable));
                }
            }
            // Locked: everything else
            else {
                this.locked.push(this._createPerkEntry(data, PerkState.unavailable));
            }
        }
        
        // Sort each category
        this._sortPerkLists();
    }

    /**
     * Check if perk is auto-unlocked based on predicates
     */
    _isAutoUnlocked(perk) {
        if (!this.actor || !perk.system?.autoUnlock) return false;
        
        try {
            // Resolve the autoUnlock predicate using the game's SummonStatistic resolver
            const resolvedPredicate = game.ptr.SummonStatistic?.resolveValue?.(
                perk.system.autoUnlock,
                perk.system.autoUnlock,
                { actor: this.actor, item: perk },
                { evaluate: true, resolvables: { actor: this.actor, item: perk } }
            );
            
            if (!resolvedPredicate) return false;
            
            // Create a Predicate and test it against actor's roll options
            const predicate = new Predicate(resolvedPredicate);
            if (predicate.length === 0) return false;
            
            return predicate.test(this.actor.getRollOptions());
        } catch (e) {
            console.warn('Error evaluating autoUnlock predicate:', e);
            return false;
        }
    }

    /**
     * Get the cost of a perk (considering tiers and root status)
     */
    _getPerkCost(perk, node, tierInfo) {
        if (tierInfo && !tierInfo.maxTierPurchased) {
            return tierInfo.perk.system?.cost || 0;
        }
        
        // Root nodes have special pricing
        if (node.type === 'root') {
            // Check if this specific root is already purchased
            if (this._purchasedSlugs.has(perk.slug)) {
                return 0; // Already owned, no cost
            }
            
            // Use cached value (#2, #11)
            const hasAnyPurchasedRoot = this._hasAnyPurchasedRoot;
            
            // First root is free
            if (!hasAnyPurchasedRoot) {
                return 0;
            }
            
            // If we already have a root, check if this root is connected to any purchased perks
            const connections = this._connectionMap.get(perk.slug) || new Set();
            // Use Set iteration directly (#11)
            let isConnectedToPurchased = false;
            for (const connSlug of connections) {
                if (this._purchasedSlugs.has(connSlug)) {
                    isConnectedToPurchased = true;
                    break;
                }
            }
            return isConnectedToPurchased ? 1 : 5;
        }
        
        return perk.system?.cost || 0;
    }

    /**
     * Check if prerequisites are met, or can be met with available skill points
     * Uses cached results when available (#7)
     */
    _meetsPrerequisites(perk, tierInfo) {
        // Try to use cached result first
        const slug = perk.slug;
        if (this._prerequisiteCache.has(slug)) {
            return this._prerequisiteCache.get(slug);
        }
        
        // Fallback to evaluation if not cached (shouldn't happen after _cachePrerequisites)
        return this._evaluatePrerequisites(perk, tierInfo);
    }
    
    /**
     * Check if skill-based prerequisites can be met with available skill points
     * @param {Predicate} predicate - The predicate to check
     * @returns {boolean} - True if prerequisites can be met with available skill points
     */
    _canMeetPrerequisitesWithSkillPoints(predicate, name="") {
        if (!this.actor) return false;
        
        const availableRVs = this.actor.system?.advancement?.rvs?.available || 0;
        if (availableRVs === 0) return false;
        
        // Parse the predicate to find skill requirements and check for non-skill requirements
        const { skillRequirements, hasNonSkillRequirements } = this._parseSkillRequirements(predicate);
        if (skillRequirements.length === 0) return false;
        
        // If there are non-skill requirements mixed in, we need ALL of them to already be met
        // Check if the predicate would pass if we only removed the skill requirements
        if (hasNonSkillRequirements) {
            // Create a modified predicate with skill requirements removed
            const nonSkillStatements = [];
            for (const statement of predicate) {
                if (typeof statement === 'string') {
                    if (!statement.match(/^skill:([^:]+):(\d+)$/)) {
                        nonSkillStatements.push(statement);
                    }
                } else if (typeof statement === 'object') {
                    const isSkill = this._isSkillStatement(statement);
                    if (!isSkill) {
                        nonSkillStatements.push(statement);
                    }
                }
            }
            
            // If there are non-skill requirements, they must all be met
            if (nonSkillStatements.length > 0) {
                const nonSkillPredicate = new Predicate(nonSkillStatements);
                if (!nonSkillPredicate.test(this.actor.getRollOptions())) {
                    return false; // Non-skill requirements not met
                }
            }
        }
        
        // Calculate total RVs needed to meet all skill requirements
        let totalNeeded = 0;
        for (const { slug, required } of skillRequirements) {
            const skill = this.actor.system?.skills?.get(slug);
            if (!skill) continue;
            
            const currentValue = skill.total || 0;
            const currentRVs = skill.rvs || 0;

            if (currentValue >= required) continue; // Already meets this requirement
            
            const neededIncrease = required - currentValue;
            const maxPossibleIncrease = (this.actor.level === 1 ? 90 : 100) - currentRVs;

            // Can't meet this requirement even with all available points
            if (neededIncrease > maxPossibleIncrease) return false;
            
            totalNeeded += neededIncrease;
        }

        // If totalNeeded is 0, all skill requirements are already met
        // If totalNeeded > 0, check if we have enough available RVs
        return totalNeeded === 0 || totalNeeded <= availableRVs;
    }
    
    /**
     * Parse a predicate to extract skill requirements
     * @param {Predicate} predicate - The predicate to parse
     * @returns {Object} - { skillRequirements: Array of {slug, required}, hasNonSkillRequirements: boolean }
     */
    _parseSkillRequirements(predicate) {
        const requirements = [];
        let hasNonSkillRequirements = false;
        
        // Predicates are arrays of predicate statements
        for (const statement of predicate) {
            let isSkillRequirement = false;
            
            if (typeof statement === 'string') {
                // Check for skill:value pattern (e.g., "skill:acrobatics:5")
                const skillMatch = statement.match(/^skill:([^:]+):(\d+)$/);
                if (skillMatch) {
                    requirements.push({
                        slug: skillMatch[1],
                        required: parseInt(skillMatch[2], 10)
                    });
                    isSkillRequirement = true;
                } else {
                    // Any other string is a non-skill requirement
                    hasNonSkillRequirements = true;
                }
            } else if (typeof statement === 'object') {
                // Handle comparison operators like { "gte": ["{actor|skills.fast-talk.mod}", 55] }
                if (statement.gte && Array.isArray(statement.gte)) {
                    const [skillKey, value] = statement.gte;
                    
                    // Try to extract skill slug from actor|skills.slug.mod pattern
                    const actorSkillMatch = skillKey?.match(/^\{actor\|skills\.([^.]+)\.mod\}$/);
                    if (actorSkillMatch && typeof value === 'number') {
                        requirements.push({
                            slug: actorSkillMatch[1],
                            required: value
                        });
                        isSkillRequirement = true;
                    } else {
                        // Fallback to old skill:slug pattern
                        const skillMatch = skillKey?.match(/^skill:([^:]+)$/);
                        if (skillMatch && typeof value === 'number') {
                            requirements.push({
                                slug: skillMatch[1],
                                required: value
                            });
                            isSkillRequirement = true;
                        } else {
                            // Not a skill requirement
                            hasNonSkillRequirements = true;
                        }
                    }
                }
                // Handle other comparison operators similarly
                else if (statement.gt && Array.isArray(statement.gt)) {
                    const [skillKey, value] = statement.gt;
                    
                    // Try actor|skills pattern
                    const actorSkillMatch = skillKey?.match(/^\{actor\|skills\.([^.]+)\.mod\}$/);
                    if (actorSkillMatch && typeof value === 'number') {
                        requirements.push({
                            slug: actorSkillMatch[1],
                            required: value + 1 // gt means greater than, so we need value + 1
                        });
                        isSkillRequirement = true;
                    } else {
                        // Fallback to skill:slug pattern
                        const skillMatch = skillKey?.match(/^skill:([^:]+)$/);
                        if (skillMatch && typeof value === 'number') {
                            requirements.push({
                                slug: skillMatch[1],
                                required: value + 1
                            });
                            isSkillRequirement = true;
                        } else {
                            // Not a skill requirement
                            hasNonSkillRequirements = true;
                        }
                    }
                } else {
                    // Any other object structure is a non-skill requirement
                    hasNonSkillRequirements = true;
                }
            }
        }
        
        return { skillRequirements: requirements, hasNonSkillRequirements };
    }

    /**
     * Check if a predicate statement is a skill requirement
     * @param {Object} statement - The predicate statement object
     * @returns {boolean} - True if this is a skill requirement
     */
    _isSkillStatement(statement) {
        if (typeof statement !== 'object') return false;
        
        // Check gte operator
        if (statement.gte && Array.isArray(statement.gte)) {
            const [skillKey] = statement.gte;
            if (skillKey?.match(/^\{actor\|skills\.([^.]+)\.mod\}$/)) return true;
            if (skillKey?.match(/^skill:([^:]+)$/)) return true;
        }
        
        // Check gt operator
        if (statement.gt && Array.isArray(statement.gt)) {
            const [skillKey] = statement.gt;
            if (skillKey?.match(/^\{actor\|skills\.([^.]+)\.mod\}$/)) return true;
            if (skillKey?.match(/^skill:([^:]+)$/)) return true;
        }
        
        return false;
    }

    /**
     * Create a perk entry for the list with all needed data
     */
    _createPerkEntry(data, state) {
        const { perk, node, slug, tierInfo } = data;
        const isEvolution = !!perk.flags?.ptr2e?.evolution;
        
        // Use plain description for now (enrichment can be added later if needed)
        const description = perk.system?.description || '';
        
        return {
            perk,
            node,
            slug,
            name: perk.name,
            img: node.config?.texture || perk.img,
            cost: this._getPerkCost(perk, node, tierInfo),
            state,
            tierInfo,
            isEvolution,
            evolutionTier: isEvolution ? perk.flags.ptr2e.evolution.tier : null,
            uuid: perk.uuid,
            description,
            enrichedDescription: description // For now, same as description
        };
    }

    /**
     * Sort perk lists: evolutions first, then by cost, then by name
     */
    _sortPerkLists() {
        const sortFn = (a, b) => {
            // Evolutions first
            if (a.isEvolution && !b.isEvolution) return -1;
            if (!a.isEvolution && b.isEvolution) return 1;
            
            // Within evolutions, sort by tier
            if (a.isEvolution && b.isEvolution) {
                if (a.evolutionTier !== b.evolutionTier) {
                    return a.evolutionTier - b.evolutionTier;
                }
            }
            
            // Then by cost (use displayCost if available, otherwise use cost)
            const costA = a.displayCost ?? a.cost;
            const costB = b.displayCost ?? b.cost;
            if (costA !== costB) {
                return costA - costB;
            }
            
            // Finally by name
            return a.name.localeCompare(b.name);
        };
        
        this.purchased.sort(sortFn);
        this.availableNow.sort(sortFn);
        this.availableLater.sort(sortFn);
        this.locked.sort(sortFn);
        
        // Filter Minor Buff perks - keep only one in Available Now, remove all from Available Later
        this._filterMinorBuffPerks();
    }
    
    /**
     * Filter Minor Buff perks to reduce clutter
     * - Keep only one Minor Buff in Available Now
     * - Remove all Minor Buff from Available Later
     */
    _filterMinorBuffPerks() {
        let foundMinorBuffAvailable = false;
        
        // Filter Available Now - keep only the first Minor Buff
        this.availableNow = this.availableNow.filter(perk => {
            if (perk.name === 'Minor Buff') {
                if (foundMinorBuffAvailable) {
                    return false; // Skip subsequent Minor Buffs
                }
                foundMinorBuffAvailable = true;
                return true; // Keep the first one
            }
            return true; // Keep all non-Minor Buff perks
        });
        
        // Filter Available Later - remove all Minor Buffs
        this.availableLater = this.availableLater.filter(perk => perk.name !== 'Minor Buff');
    }

    /**
     * Reinitialize with new data
     */
    async reinitialize({ perks, actor, web } = {}) {
        if (perks) this.perks = perks;
        if (actor !== undefined) this.actor = actor;
        if (web) this.web = web;
        
        // Clear all state
        this.purchased = [];
        this.availableNow = [];
        this.availableLater = [];
        this.locked = [];
        this._perkMap.clear();
        this._connectionMap.clear();
        this._purchasedSlugs.clear();
        this._reachableSlugs.clear();
        this._seenUuids.clear();
        this._seenPositions.clear();
        this._prerequisiteCache.clear();
        this._unsatisfiablePrereqs.clear();
        this._initialized = false;
        
        // Reinitialize
        await this.initialize();
    }

    /**
     * Get a summary of perk counts by category
     */
    getSummary() {
        return {
            purchased: this.purchased.length,
            availableNow: this.availableNow.length,
            availableLater: this.availableLater.length,
            locked: this.locked.length,
            total: this._perkMap.size
        };
    }

    /**
     * Get all perks in a specific category
     */
    getCategory(category) {
        switch (category) {
            case 'purchased': return this.purchased;
            case 'availableNow': return this.availableNow;
            case 'availableLater': return this.availableLater;
            case 'locked': return this.locked;
            default: return [];
        }
    }

    /**
     * Search perks across all categories
     */
    search(query) {
        const lowerQuery = query.toLowerCase();
        const allPerks = [
            ...this.purchased,
            ...this.availableNow,
            ...this.availableLater,
            ...this.locked
        ];
        
        return allPerks.filter(entry => 
            entry.name.toLowerCase().includes(lowerQuery) ||
            entry.description.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Show the perk list in an ApplicationV2 dialog
     * @param {Object} options - Dialog options
     * @returns {PerkListApplication} The rendered application
     */
    showDialog(options = {}) {
        const app = new PerkListApplication({ manager: this, ...options });
        app.render(true);
        return app;
    }

    /**
     * Purchase a perk for the actor
     * @param {string} slug - The perk slug
     * @param {string} uuid - The perk UUID
     */
    async _purchasePerk(slug, uuid) {
        if (!this.actor) {
            throw new Error('No actor available for perk purchase');
        }
        
        // Find the perk entry
        const perkEntry = [...this.availableNow, ...this.availableLater].find(p => p.slug === slug);
        if (!perkEntry) {
            throw new Error('Perk not found in available perks');
        }
        
        if (perkEntry.state !== PerkState.available) {
            throw new Error('Perk is not available for purchase');
        }
        
        const perk = perkEntry.tierInfo?.perk ?? perkEntry.perk;
        const currentNode = perkEntry;
        
        // Handle tiered perks with "replace" mode
        if (currentNode.perk.system?.variant === 'tiered' && currentNode.perk.system?.mode === 'replace') {
            const current = this.actor.perks.get(currentNode.perk.slug);
            
            // Preserve old choice sets
            const oldChoiceSets = new Map();
            if (current) {
                for (const effect of current.effects.contents) {
                    for (const change of effect.changes) {
                        if (change.type === 'choice-set') {
                            const key = change.rollOption ?? change.flag;
                            oldChoiceSets.set(key, change);
                        }
                    }
                }
            }
            
            const newPerk = perk.clone({
                system: {
                    cost: perk.system.cost,
                    originSlug: currentNode.tierInfo?.perk.slug ?? currentNode.slug
                }
            }).toObject();
            
            // Restore choice set selections
            for (const effect of newPerk.effects) {
                for (const change of effect.system?.changes || []) {
                    if (change.type === 'choice-set') {
                        const old = oldChoiceSets.get(change.rollOption ?? change.flag);
                        if (old?.selection) {
                            change.selection = old.selection;
                        }
                    }
                }
            }
            
            // Check if has effect grants
            const hasEffectGrants = newPerk.effects.some(effect => 
                effect.system?.changes?.some(change => 
                    ['grant-item', 'grant-effect'].includes(change.type)
                )
            );
            
            if (current) {
                newPerk.flags = newPerk.flags || {};
                newPerk.flags.ptr2e = newPerk.flags.ptr2e || {};
                newPerk.flags.ptr2e = foundry.utils.mergeObject(
                    newPerk.flags.ptr2e, 
                    current.toObject().flags.ptr2e, 
                    { inplace: false }
                );
                newPerk.flags.ptr2e.tierSlug = currentNode.tierInfo?.perk.slug ?? currentNode.slug;
                newPerk.system.originSlug = current.system.originSlug;
            }
            
            if (hasEffectGrants) {
                await current?.delete();
                await CONFIG.Item.documentClass.create(newPerk, { parent: this.actor });
            } else if (current) {
                if (current.effects.size) {
                    await current.deleteEmbeddedDocuments("ActiveEffect", current.effects.map(e => e.id));
                }
                await current.update({
                    name: newPerk.name,
                    img: newPerk.img,
                    effects: newPerk.effects,
                    system: newPerk.system,
                    "flags.ptr2e": newPerk.flags.ptr2e
                });
            }
        } else {
            // Standard perk purchase
            await CONFIG.Item.documentClass.create(perk.clone({
                system: {
                    cost: perk.system.cost,
                    originSlug: currentNode.tierInfo?.perk.slug ?? currentNode.slug
                }
            }).toObject(), {
                parent: this.actor
            });
        }
        
        ui.notifications.info(`Purchased ${perk.name} for ${perk.system.cost} AP`);
    }

    /**
     * Purchase a perk and all its prerequisites in the path, allocating skill points as needed
     * @param {string} slug - The target perk slug
     * @param {string} uuid - The target perk UUID
     */
    async _purchasePerkPath(slug, uuid) {
        if (!this.actor) {
            throw new Error('No actor available for perk purchase');
        }
        
        // Find the perk entry in Available Later
        const perkEntry = this.availableLater.find(p => p.slug === slug);
        if (!perkEntry) {
            throw new Error('Perk not found in Available Later perks');
        }
        
        if (!perkEntry.pathToReach || perkEntry.pathToReach.length === 0) {
            throw new Error('No path found for this perk');
        }
        
        // Collect all skill requirements from the entire path (including the target perk)
        const allSkillRequirements = new Map(); // slug -> required value
        
        // Check each perk in the path for skill requirements
        const perksToCheck = [...perkEntry.pathToReach.map(p => p.perk), perkEntry.perk];
        for (const perk of perksToCheck) {
            const prerequisites = perk.system?.prerequisites;
            if (!prerequisites || prerequisites.length === 0) continue;
            
            try {
                // Resolve prerequisites using the game's SummonStatistic resolver
                let resolvedPredicate = game.ptr.SummonStatistic?.resolveValue?.(
                    prerequisites,
                    prerequisites,
                    { actor: this.actor, item: perk },
                    { evaluate: true, resolvables: { actor: this.actor, item: perk } }
                );
                
                // If resolveValue returns undefined, use the raw prerequisites
                if (!resolvedPredicate) {
                    resolvedPredicate = prerequisites;
                }
                
                const predicate = new Predicate(resolvedPredicate);
                const skillRequirements = this._parseSkillRequirements(predicate);
                
                for (const { slug: skillSlug, required } of skillRequirements) {
                    const current = allSkillRequirements.get(skillSlug) || 0;
                    allSkillRequirements.set(skillSlug, Math.max(current, required));
                }
            } catch (e) {
                console.warn(`Error parsing prerequisites for ${perk.name}:`, e);
            }
        }
        
        // Allocate skill points if needed
        if (allSkillRequirements.size > 0) {
            await this._allocateSkillPoints(allSkillRequirements);
        }
        
        // Purchase each perk in the path in order
        for (const { perk, cost } of perkEntry.pathToReach) {
            await this._purchaseSinglePerk(perk, cost);
        }
        
        // Purchase the target perk
        await this._purchaseSinglePerk(perkEntry.perk, perkEntry.cost);
        
        const totalCost = perkEntry.displayCost ?? perkEntry.cost;
        ui.notifications.info(`Purchased path to ${perkEntry.name} for ${totalCost} AP (${perkEntry.pathToReach.length + 1} perks)`);
    }
    
    /**
     * Allocate skill points to meet requirements
     * @param {Map} skillRequirements - Map of skill slug to required value
     */
    async _allocateSkillPoints(skillRequirements) {
        const actorUpdates = {};
        const skills = this.actor.system.toObject().skills;
        
        for (const [skillSlug, requiredValue] of skillRequirements) {
            const skill = skills.find(s => s.slug === skillSlug);
            if (!skill) continue;
            
            // Get the current skill from the actor (not the plain object) to get accurate total
            const currentSkill = this.actor.system.skills.get(skillSlug);
            const currentValue = currentSkill?.total || 0;
            
            if (currentValue >= requiredValue) continue; // Already meets requirement
            
            const delta = requiredValue - currentValue;
            skill.rvs = (skill.rvs || 0) + delta;
        }
        
        actorUpdates["system.skills"] = skills;
        
        if (Object.keys(actorUpdates).length > 0) {
            await this.actor.update(actorUpdates);
            ui.notifications.info(`Allocated skill points to meet prerequisites`);
        }
    }
    
    /**
     * Purchase a single perk without checking prerequisites (used by path purchase)
     * @param {Object} perk - The perk to purchase
     * @param {number} cost - The cost of the perk
     */
    async _purchaseSinglePerk(perk, cost) {
        await CONFIG.Item.documentClass.create(perk.clone({
            system: {
                cost: cost,
                originSlug: perk.slug
            }
        }).toObject(), {
            parent: this.actor
        });
    }
}

/**
 * Helper function to create a perk list manager from game data
 * This would typically be called from the game system
 */
export async function createPerkListManager(actor) {
    // Fetch perks from the game's perk system
    if (!game.ptr?.perks?.initialized) {
        await game.ptr.perks.initialize();
    }
    
    const perks = Array.from(game.ptr.perks.perks.values());
    
    // Add species evolution and underdog perks if actor has a species
    if (actor) {
        try {
            const species = actor.items?.get?.('actorspeciesitem');
            if (species) {
                // Get evolution perks for this species
                if (species.system?.getEvolutionPerks) {
                    const isShiny = !!actor.system?.shiny;
                    const evolutionPerks = await species.system.getEvolutionPerks(isShiny);
                    perks.push(...evolutionPerks);
                }
            }
            
            // Get underdog perks for this actor
            if (actor.getUnderdogPerks) {
                const underdogPerks = await actor.getUnderdogPerks();
                perks.push(...underdogPerks);
            }
        } catch (e) {
            console.warn('Error fetching species-specific perks:', e);
        }
    }
    
    // Use 'combined' as the web type to show all perks
    const manager = new PerkListManager({ perks, actor, web: 'combined' });
    await manager.initialize();
    
    return manager;
}

/**
 * ApplicationV2 class for the Perk List dialog
 */
export class PerkListApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
        super.DEFAULT_OPTIONS,
        {
            classes: ["sheet", "pokemon-assets", "perk-list"],
            position: {
                height: 800,
                width: 700,
            },
            window: {
                title: "Perk List",
                minimizable: true,
                resizable: true,
            },
        },
        { inplace: false }
    );

    static PARTS = {
        main: {
            id: "perk-list",
            template: "modules/pokemon-assets/templates/ptr2e/perk-list.hbs",
        },
    };

    constructor(options = {}) {
        super(options);
        this.manager = options.manager;
        if (!this.manager) {
            throw new Error('PerkListApplication requires a manager instance');
        }
    }

    get title() {
        if (this.manager.actor) return `${this.manager.actor.name} - Perk List`;
        return "Perk List";
    }

    async _prepareContext() {
        const summary = this.manager.getSummary();
        const apAvailable = this.manager.actor?.system?.advancement?.advancementPoints?.available || 0;
        const rvsAvailable = this.manager.actor?.system?.advancement?.rvs?.available || 0;

        // Helper function to prepare perk entries for the template
        const preparePerkEntries = (perks) => {
            return perks.map(entry => {
                const stateClass = {
                    0: 'unavailable',
                    1: 'connected',
                    2: 'available',
                    3: 'purchased',
                    4: 'invalid',
                    5: 'auto-unlocked'
                }[entry.state];

                // Determine if we should show a purchase button
                const isAvailableLater = entry.pathToReach && entry.pathToReach.length > 0;
                
                // Available Now perks have state 2, Available Later perks have state 1
                const canPurchase = entry.state === 2 || (isAvailableLater && entry.state === 1);
                
                // For "Available Later" perks, check if we can afford the total path cost
                const costToCheck = isAvailableLater ? (entry.displayCost ?? entry.cost) : entry.cost;
                const canAfford = canPurchase && costToCheck <= apAvailable;

                // Build path chain string for "Available Later" perks
                let pathChain = entry.pathToReach?.map(data => data.perk) ?? [];

                return {
                    ...entry,
                    stateClass,
                    isPath: isAvailableLater,
                    canAfford,
                    pathChain,
                    displayCost: entry.displayCost ?? entry.cost
                };
            });
        };

        return {
            summary,
            apAvailable,
            rvsAvailable,
            purchased: preparePerkEntries(this.manager.purchased),
            availableNow: preparePerkEntries(this.manager.availableNow),
            availableLater: preparePerkEntries(this.manager.availableLater),
            locked: preparePerkEntries(this.manager.locked),
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);

        // Add click handlers to view perk sheets
        this.element.querySelectorAll('.perk-entry').forEach(entry => {
            entry.addEventListener('click', async (e) => {
                // Don't open sheet if clicking the purchase button
                if (e.target.closest('.purchase-perk')) return;
                
                e.preventDefault();
                const uuid = entry.dataset.uuid;
                const perk = await fromUuid(uuid);
                if (perk?.sheet) {
                    perk.sheet.render(true);
                }
            });
        });

        // Add purchase button handlers
        this.element.querySelectorAll('.purchase-perk').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const slug = button.dataset.slug;
                const uuid = button.dataset.uuid;
                const isPath = button.dataset.isPath === 'true';
                
                // Disable button during purchase
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Purchasing...';
                
                try {
                    if (isPath) {
                        await this.manager._purchasePerkPath(slug, uuid);
                    } else {
                        await this.manager._purchasePerk(slug, uuid);
                    }
                    
                    // Refresh the application with updated data
                    await this.manager.reinitialize({ 
                        perks: this.manager.perks, 
                        actor: this.manager.actor, 
                        web: this.manager.web 
                    });
                    this.render(true);
                } catch (error) {
                    console.error('Error purchasing perk:', error);
                    ui.notifications.error(`Failed to purchase perk: ${error.message}`);
                    button.disabled = false;
                    button.innerHTML = `<i class="fas fa-${isPath ? 'route' : 'cart-plus'}"></i> Purchase${isPath ? ' Path' : ''}`;
                }
            });
        });
    }
}


export function register() {
    loadTemplates([`modules/pokemon-assets/templates/ptr2e/perk-list.hbs`, `modules/pokemon-assets/templates/ptr2e/perk-list-category.hbs`]);
}