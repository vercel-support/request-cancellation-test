import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let cancelled = false;

  // Listen for request cancellation
  request.signal.addEventListener("abort", () => {
    cancelled = true;
    console.log("🛑 Request was cancelled by client");
  });

  const stream = new ReadableStream({
    async start(controller) {
      const totalSteps = 10;

      for (let i = 1; i <= totalSteps; i++) {
        // Check if request was cancelled
        if (cancelled || request.signal.aborted) {
          console.log(`⚠️ Stopping at step ${i} due to cancellation`);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "cancelled", step: i })}\n\n`
            )
          );
          controller.close();
          return;
        }

        // Simulate work (1 second per step)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Send progress update
        const message = {
          type: "progress",
          step: i,
          totalSteps,
          message: `Processing step ${i} of ${totalSteps}...`,
          timestamp: new Date().toISOString(),
        };

        console.log(`✅ Completed step ${i}/${totalSteps}`);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
        );
      }

      // Send completion message
      const completionMessage = {
        type: "complete",
        message: "All steps completed successfully!",
        timestamp: new Date().toISOString(),
      };

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(completionMessage)}\n\n`)
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
