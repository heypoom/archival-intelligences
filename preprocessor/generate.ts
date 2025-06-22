#!/usr/bin/env bun

import { BatchGenerator } from './batch-generator'

async function main() {
  console.log('🎨 Archival Intelligences - Mode B Batch Generator')
  console.log('=' .repeat(50))

  const generator = new BatchGenerator()

  try {
    // Initialize and validate environment
    const isValid = await generator.validateEnvironment()
    if (!isValid) {
      console.error('❌ Environment validation failed. Please check your configuration.')
      process.exit(1)
    }

    // Initialize generation tasks
    await generator.initialize()

    // Show generation statistics
    const stats = generator.getStats()
    console.log('\n📊 Generation Statistics:')
    console.log(`   Total Tasks: ${stats.totalTasks}`)
    console.log(`   Total Sets: ${stats.totalSets}`)
    console.log(`   Total Images: ${stats.totalImages}`)
    console.log(`   Estimated Time: ${stats.estimatedTime}`)
    console.log(`   Estimated Storage: ${stats.estimatedStorage}`)

    // Confirm before starting
    console.log('\n⚠️  This will generate a large number of images and may take several hours.')
    console.log('   Make sure you have sufficient Modal credits and R2 storage quota.')
    
    const shouldContinue = process.argv.includes('--force') || 
                          process.argv.includes('--yes') ||
                          process.env.BATCH_GENERATE_CONFIRM === 'true'

    if (!shouldContinue) {
      console.log('\n❓ Continue with batch generation? (Use --force to skip this prompt)')
      console.log('   Press Ctrl+C to cancel, or run with --force flag to proceed automatically.')
      
      // Wait for user confirmation in interactive mode
      process.stdin.setRawMode(true)
      process.stdin.resume()
      await new Promise<void>((resolve) => {
        process.stdin.once('data', (data) => {
          const key = data.toString()
          if (key === '\u0003') { // Ctrl+C
            console.log('\n❌ Cancelled by user')
            process.exit(0)
          }
          resolve()
        })
      })
      process.stdin.setRawMode(false)
      process.stdin.pause()
    }

    // Start batch generation
    console.log('\n🚀 Starting batch generation...')
    const startTime = Date.now()

    // Check if we should resume from a specific point
    const resumeFrom = process.env.RESUME_FROM_ACTION
    if (resumeFrom) {
      await generator.resumeGeneration(resumeFrom)
    } else {
      await generator.generateAllSets()
    }

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    console.log(`\n🎉 Batch generation completed successfully!`)
    console.log(`   Total time: ${totalTime} minutes`)
    console.log(`   Manifest saved: manifest.json`)
    console.log(`   All images uploaded to R2 storage`)

  } catch (error) {
    console.error('\n❌ Batch generation failed:', error)
    
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack)
    }
    
    console.log('\n💡 Troubleshooting tips:')
    console.log('   - Check your Modal endpoint is running and accessible')
    console.log('   - Verify R2 credentials and bucket permissions')
    console.log('   - Ensure sufficient Modal credits for GPU usage')
    console.log('   - Try resuming with RESUME_FROM_ACTION=<action_id>')
    
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Received interrupt signal. Shutting down gracefully...')
  console.log('   Current progress has been saved.')
  console.log('   You can resume later using RESUME_FROM_ACTION environment variable.')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n⚠️  Received termination signal. Shutting down gracefully...')
  process.exit(0)
})

// Run the main function
main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})