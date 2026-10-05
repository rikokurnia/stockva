import type { RebalanceReceipt } from "./contracts";
import type { RebalanceStep } from "./rebalance";
import type { RebalanceExecution } from "./rebalance-execution";

type SequenceIO = {
  save: (run: RebalanceExecution) => void;
  send: (
    step: RebalanceStep,
    submitted: (hash: `0x${string}`) => void,
    approved: (hash: `0x${string}`) => void,
  ) => Promise<`0x${string}`>;
  confirm: (
    step: RebalanceStep,
    hash: `0x${string}`,
    canonical: (hash: `0x${string}`) => void,
  ) => Promise<RebalanceReceipt>;
  apply: (step: RebalanceStep, receipt: RebalanceReceipt) => string;
};

/** Persist each hash before waiting; recovery only polls an existing transaction. */
export async function executeSequentialRebalance(
  initial: RebalanceExecution,
  io: SequenceIO,
): Promise<RebalanceExecution> {
  let run = { ...initial, mode: "sequential" as const };
  const update = (
    stepId: string,
    patch: Partial<RebalanceExecution["steps"][number]>,
  ) => {
    run = {
      ...run,
      steps: run.steps.map((s) =>
        s.stepId === stepId ? { ...s, ...patch } : s,
      ),
    };
    io.save(run);
  };
  for (const step of run.plan.steps) {
    const progress = run.steps.find((s) => s.stepId === step.id);
    if (!progress) throw new Error("The saved rebalance is missing a step.");
    if (progress.status === "confirmed") continue;
    let hash = progress.reverted ? undefined : progress.hash;
    try {
      if (!hash) {
        update(step.id, {
          status: "wallet",
          error: undefined,
          reverted: undefined,
          hash: undefined,
        });
        hash = await io.send(
          step,
          (hash) => update(step.id, { status: "submitted", hash }),
          (approvalHash) => update(step.id, { approvalHash }),
        );
        update(step.id, { status: "submitted", hash });
      }
      const receipt = await io.confirm(step, hash, (hash) =>
        update(step.id, { hash }),
      );
      const fingerprint = io.apply(step, receipt);
      run = { ...run, fingerprint };
      update(step.id, {
        status: "confirmed",
        hash: receipt.hash,
        error: undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Transaction confirmation failed.";
      update(step.id, {
        status: "error",
        error: message,
        ...(/transaction reverted|replaced or cancelled on-chain/i.test(message)
          ? { reverted: true }
          : {}),
      });
      throw error;
    }
  }
  return run;
}
