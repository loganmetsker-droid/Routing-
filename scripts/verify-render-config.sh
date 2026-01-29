#!/bin/bash
# Render Configuration Verification Script
# Run this after setting up your Render services

echo "🔍 Verifying Render Configuration..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL is not set${NC}"
    echo "   Set this in Render Dashboard → Environment"
else
    echo -e "${GREEN}✓ DATABASE_URL is set${NC}"

    # Validate format
    if [[ $DATABASE_URL == postgres://* ]] || [[ $DATABASE_URL == postgresql://* ]]; then
        echo -e "${GREEN}✓ DATABASE_URL format is valid${NC}"

        # Extract and display connection info (masked)
        MASKED_URL=$(echo $DATABASE_URL | sed 's/:\/\/[^:]*:\([^@]*\)@/:\/\/USER:****@/')
        echo "   URL: $MASKED_URL"
    else
        echo -e "${RED}❌ DATABASE_URL format is invalid${NC}"
        echo "   Should start with: postgres:// or postgresql://"
    fi
fi

echo ""

# Check NODE_ENV
if [ -z "$NODE_ENV" ]; then
    echo -e "${YELLOW}⚠ NODE_ENV is not set (will default to development)${NC}"
    echo "   Recommended: Set to 'production' in Render"
elif [ "$NODE_ENV" = "production" ]; then
    echo -e "${GREEN}✓ NODE_ENV is set to production${NC}"
else
    echo -e "${YELLOW}⚠ NODE_ENV is set to '$NODE_ENV'${NC}"
    echo "   Recommended: Change to 'production'"
fi

echo ""

# Check PORT
if [ -z "$PORT" ]; then
    echo -e "${YELLOW}⚠ PORT is not set (Render usually auto-sets this)${NC}"
else
    echo -e "${GREEN}✓ PORT is set to $PORT${NC}"
fi

echo ""

# Test database connection
if [ ! -z "$DATABASE_URL" ]; then
    echo "🔌 Testing database connection..."

    # Try to connect using psql if available
    if command -v psql &> /dev/null; then
        if psql "$DATABASE_URL" -c "SELECT version();" &> /dev/null; then
            echo -e "${GREEN}✓ Database connection successful!${NC}"
        else
            echo -e "${RED}❌ Database connection failed${NC}"
            echo "   Check if PostgreSQL service is running"
        fi
    else
        echo -e "${YELLOW}⚠ psql not installed, skipping connection test${NC}"
        echo "   Install postgresql-client to enable connection testing"
    fi
fi

echo ""
echo "📋 Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count checks
CHECKS_PASSED=0
TOTAL_CHECKS=3

[ ! -z "$DATABASE_URL" ] && CHECKS_PASSED=$((CHECKS_PASSED + 1))
[ "$NODE_ENV" = "production" ] && CHECKS_PASSED=$((CHECKS_PASSED + 1))
[ ! -z "$PORT" ] && CHECKS_PASSED=$((CHECKS_PASSED + 1))

echo "Checks passed: $CHECKS_PASSED/$TOTAL_CHECKS"

if [ $CHECKS_PASSED -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}✓ Configuration looks good!${NC}"
    echo "  You can proceed with deployment"
else
    echo -e "${YELLOW}⚠ Some configuration issues detected${NC}"
    echo "  Review the messages above and fix issues in Render Dashboard"
fi

echo ""
echo "Next steps:"
echo "1. Fix any ❌ or ⚠ issues in Render Dashboard"
echo "2. Click 'Manual Deploy' or push to trigger deployment"
echo "3. Monitor logs for successful startup"
