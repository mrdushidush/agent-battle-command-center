# Code Changes Required for Complexity Model Simplification

After running the SQL migration, update these files to use new field names:

## Field Mapping

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `routerComplexity` | (removed) | Store temporarily in assessmentMethod |
| `haikuComplexity` | (removed) | Store temporarily in assessmentMethod |
| `haikuReasoning` | `complexityReasoning` | Direct rename |
| `finalComplexity` | `complexity` | Direct rename |
| `actualComplexity` | (removed) | Rarely used |

## Files to Update

### 1. `packages/api/src/services/complexityAssessor.ts`

**Interface DualAssessment (line 19):**
```typescript
// OLD
interface DualAssessment {
  routerComplexity: number;
  haikuComplexity: number;
  haikuReasoning: string;
  finalComplexity: number;
  assessmentMethod: 'dual' | 'router_only' | 'haiku_only';
}

// NEW
interface DualAssessment {
  complexity: number;          // The final score
  complexitySource: string;    // 'router', 'haiku', 'dual'
  complexityReasoning: string; // Explanation
}
```

### 2. `packages/api/src/services/taskRouter.ts`

**RoutingDecision interface (line 52):**
```typescript
// OLD
complexity: number;
routerComplexity?: number;
haikuComplexity?: number;
haikuReasoning?: string;

// NEW
complexity: number;
complexitySource?: string;
complexityReasoning?: string;
```

**Task update (line 296-305):**
```typescript
// OLD
await this.prisma.task.update({
  where: { id: task.id },
  data: {
    routerComplexity,
    haikuComplexity,
    haikuReasoning,
    finalComplexity: complexity,
  },
});

// NEW
await this.prisma.task.update({
  where: { id: task.id },
  data: {
    complexity,
    complexitySource: assessmentMethod,
    complexityReasoning: haikuReasoning,
  },
});
```

### 3. `packages/api/src/services/taskQueue.ts`

Search for: `finalComplexity`, `routerComplexity`, `haikuComplexity`
Replace with: `complexity`, `complexitySource`, `complexityReasoning`

### 4. `packages/api/src/routes/queue.ts`

Update any references to old field names.

### 5. `packages/api/src/routes/metrics.ts`

Update any references to old field names.

### 6. `packages/api/src/services/complexityCalculator.ts`

Update any references to old field names.

### 7. `packages/api/src/services/codeReviewService.ts`

Update any references to old field names.

### 8. Test files
- `packages/api/src/services/__tests__/taskQueue.test.ts`
- `packages/api/src/services/__tests__/taskRouter.test.ts`

## Migration Order

1. Run SQL migration to add new columns and migrate data
2. Update Prisma schema (already done)
3. Run `pnpm prisma generate` to regenerate client
4. Update all code files above
5. Run tests to verify
6. Run SQL migration step 4 to drop old columns
