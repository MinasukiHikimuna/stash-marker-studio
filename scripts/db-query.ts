#!/usr/bin/env tsx

/**
 * Safe read-only database query script for development
 *
 * Usage:
 *   npx tsx scripts/db-query.ts "SELECT * FROM markers LIMIT 5"
 *   npx tsx scripts/db-query.ts --json "SELECT COUNT(*) FROM markers"
 *
 * Security: Only allows SELECT queries, rejects destructive operations
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
  'TRUNCATE', 'REPLACE', 'GRANT', 'REVOKE', 'EXECUTE'
];

function isReadOnlyQuery(query: string): boolean {
  const upperQuery = query.trim().toUpperCase();

  // Must start with SELECT (allowing whitespace/comments)
  if (!upperQuery.match(/^\s*(\/\*.*?\*\/)?\s*SELECT\s/i)) {
    return false;
  }

  // Check for forbidden keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(upperQuery)) {
      return false;
    }
  }

  return true;
}

async function runQuery(query: string, jsonOutput: boolean = false): Promise<void> {
  try {
    // Validate query is read-only
    if (!isReadOnlyQuery(query)) {
      console.error('Error: Only SELECT queries are allowed');
      console.error('Forbidden keywords detected or query does not start with SELECT');
      process.exit(1);
    }

    // Execute query
    const results = await prisma.$queryRawUnsafe(query);

    // Output results
    if (jsonOutput) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.table(results);
    }

  } catch (error) {
    console.error('Query execution error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const query = args.filter(arg => arg !== '--json').join(' ');

if (!query) {
  console.error('Usage: npx tsx scripts/db-query.ts [--json] "SELECT ..."');
  process.exit(1);
}

runQuery(query, jsonOutput);
